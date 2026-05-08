import fs from "node:fs/promises";
import { spawn } from "node:child_process";

const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));
const manifest = JSON.parse(await fs.readFile(".release-please-manifest.json", "utf8"));
const changelogPresent = await exists("CHANGELOG.md");
const tags = await git(["tag", "--list", "v*"]);
const state = {
  package: packageJson.name,
  package_version: packageJson.version,
  manifest_version: manifest["."],
  changelog_present: changelogPresent,
  local_tags: tags.stdout.trim().split(/\r?\n/).filter(Boolean),
  github_releases: [],
  open_release_prs: [],
  blockers: [],
  next_safe_command: "review release-please PR when one is opened by the guarded release workflow",
  safe_to_publish: false
};

if (state.package_version !== state.manifest_version) {
  state.blockers.push("package.json version and release-please manifest version differ");
}
if (!state.changelog_present) {
  state.blockers.push("CHANGELOG.md is missing");
}

if (!process.argv.includes("--local")) {
  const releases = await gh(["release", "list", "--repo", "oaslananka-lab/boardguard", "--limit", "20"]);
  if (releases.code === 0) {
    state.github_releases = releases.stdout.trim().split(/\r?\n/).filter(Boolean);
  }
  const prs = await gh(["pr", "list", "--repo", "oaslananka-lab/boardguard", "--search", "release-please in:title", "--json", "number,title,state,url"]);
  if (prs.code === 0 && prs.stdout.trim()) {
    state.open_release_prs = JSON.parse(prs.stdout);
  }
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

function git(args) {
  return run("git", args);
}

function gh(args) {
  return run("gh", args);
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => resolve({ code: 1, stdout, stderr: error.message }));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}
