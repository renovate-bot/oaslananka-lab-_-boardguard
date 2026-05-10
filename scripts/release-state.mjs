import fs from "node:fs/promises";
import { spawn } from "node:child_process";

const localOnly = process.argv.includes("--local");
const defaultCommandTimeoutMs = 30_000;
const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));
const manifest = JSON.parse(await fs.readFile(".release-please-manifest.json", "utf8"));
const versionModule = await readOptional("src/generated/version.ts");
const changelogPresent = await exists("CHANGELOG.md");
const tags = await git(["tag", "--list", "v*", "--sort=-v:refname"]);
const localTags = tags.stdout.trim().split(/\r?\n/).filter(Boolean);
const expectedRepository = "oaslananka-lab/boardguard";
const releaseRemote = await findRepositoryRemote(expectedRepository);

const state = {
  repository: "oaslananka-lab/boardguard",
  package_name: packageJson.name,
  package_version: packageJson.version,
  manifest_version: manifest["."],
  generated_version: parseGeneratedVersion(versionModule),
  changelog_present: changelogPresent,
  latest_v_tag: localTags[0] ?? null,
  local_tags: localTags.slice(0, 20),
  github_release_state: localOnly ? "unchecked-local" : "unchecked",
  npm_live_version: localOnly ? "unchecked-local" : "unchecked",
  open_release_prs: [],
  workflow_last_run: localOnly ? "unchecked-local" : "unchecked",
  state: "no-release",
  blockers: [],
  next_safe_command: "review release-please PR when one is opened by the guarded release workflow",
  safe_to_publish: false
};

if (!releaseRemote) {
  state.blockers.push("no git remote points to oaslananka-lab/boardguard");
}
if (state.package_version !== state.manifest_version) {
  state.blockers.push("package.json version and release-please manifest version differ");
}
if (state.generated_version !== state.package_version) {
  state.blockers.push("src/generated/version.ts version and package.json version differ");
}
if (!state.changelog_present) {
  state.blockers.push("CHANGELOG.md is missing");
}

if (!localOnly) {
  const releases = await gh(["release", "list", "--repo", "oaslananka-lab/boardguard", "--limit", "20", "--json", "tagName,isDraft,isPrerelease,createdAt"]);
  if (releases.code === 0) {
    const parsed = releases.stdout.trim() ? JSON.parse(releases.stdout) : [];
    const matchingRelease = parsed.find((release) => release.tagName === `v${state.package_version}`);
    state.github_release_state = matchingRelease ? (matchingRelease.isDraft ? "draft-exists" : "published-exists") : "none-for-package-version";
  } else {
    state.github_release_state = "unavailable";
  }

  const prs = await gh(["pr", "list", "--repo", "oaslananka-lab/boardguard", "--state", "open", "--json", "number,title,state,url,headRefName,labels,author"]);
  if (prs.code === 0 && prs.stdout.trim()) {
    state.open_release_prs = JSON.parse(prs.stdout).filter((pr) => {
      const labels = Array.isArray(pr.labels) ? pr.labels.map((label) => label.name) : [];
      return pr.headRefName?.startsWith("release-please--") || labels.some((label) => label.startsWith("autorelease:")) || /release/i.test(pr.title);
    });
    if (state.open_release_prs.length > 0) {
      state.state = "release-pr-open";
    }
  }

  const workflow = await gh(["run", "list", "--repo", "oaslananka-lab/boardguard", "--workflow", "Release", "--limit", "1", "--json", "databaseId,status,conclusion,headSha,url"]);
  if (workflow.code === 0 && workflow.stdout.trim()) {
    state.workflow_last_run = JSON.parse(workflow.stdout)[0] ?? "none";
  } else {
    state.workflow_last_run = "unavailable";
  }

  const npm = await run("npm", ["view", packageJson.name, "version", "--json"]);
  if (npm.code === 0 && npm.stdout.trim()) {
    state.npm_live_version = JSON.parse(npm.stdout);
    if (state.npm_live_version === state.package_version) {
      state.blockers.push(`npm version ${state.package_version} already exists`);
    }
  } else if (npm.stderr.includes("E404") || npm.stdout.includes("E404")) {
    state.npm_live_version = "not-published";
  } else {
    state.npm_live_version = "unavailable";
  }
}

if (state.github_release_state === "published-exists" || state.github_release_state === "draft-exists") {
  state.blockers.push(`GitHub release for v${state.package_version} already exists`);
}
if (state.blockers.length > 0) {
  state.state = "blocked";
  state.next_safe_command = "resolve release-state blockers before publishing";
} else if (localOnly) {
  state.state = "dry-run-success";
  state.next_safe_command = "push the release-readiness branch and inspect GitHub checks";
} else if (state.state === "no-release") {
  state.next_safe_command = "merge a release-please PR only after CI and required approval gates pass";
}

process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
if (state.blockers.length > 0) {
  process.exitCode = 1;
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readOptional(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return "";
  }
}

function parseGeneratedVersion(text) {
  const match = text.match(/boardGuardVersion\s*=\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

function parseRepoSlug(remoteUrl = "") {
  const normalized = remoteUrl.trim().replace(/\.git$/i, "");
  const sshMatch = normalized.match(/^[^@]+@[^:]+:(?<slug>[^/]+\/[^/]+)$/);
  if (sshMatch?.groups?.slug) {
    return sshMatch.groups.slug;
  }
  const httpsMatch = normalized.match(/^https?:\/\/github\.com\/(?<slug>[^/]+\/[^/]+)$/i);
  return httpsMatch?.groups?.slug ?? null;
}

async function findRepositoryRemote(expectedRepository) {
  const remotes = await git(["remote", "-v"]);
  if (remotes.code !== 0) {
    return null;
  }
  for (const line of remotes.stdout.trim().split(/\r?\n/)) {
    const match = line.match(/^\S+\s+(?<url>\S+)\s+\((fetch|push)\)$/);
    if (parseRepoSlug(match?.groups?.url) === expectedRepository) {
      return match.groups.url;
    }
  }
  return null;
}

function git(args) {
  return run("git", args);
}

function gh(args) {
  return run("gh", args);
}

function run(command, args, timeoutMs = defaultCommandTimeoutMs) {
  return new Promise((resolve) => {
    const invocation = process.platform === "win32"
      ? { command: "cmd.exe", args: ["/d", "/c", command, ...args] }
      : { command, args };
    const child = spawn(invocation.command, invocation.args, { shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const killTimer = setTimeout(() => {
      timedOut = true;
      stderr += `Command timed out after ${timeoutMs}ms: ${command}\n`;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(killTimer);
      resolve({ code: 1, stdout, stderr: stderr || error.message });
    });
    child.on("close", (code) => {
      clearTimeout(killTimer);
      resolve({ code: timedOut ? 124 : (code ?? 1), stdout, stderr });
    });
  });
}
