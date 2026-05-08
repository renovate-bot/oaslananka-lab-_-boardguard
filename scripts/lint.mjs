import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

const root = process.cwd();
const failures = [];
const forbiddenPaths = [
  ".agent",
  ".cursor",
  ".claude",
  ".codex",
  "chat.md",
  "instructions.md",
  "prompt.md",
  "prompts.md",
  "scratch.md",
  "notes.local.md",
  ".env",
  "node_modules",
  "coverage",
  "build"
];
const forbiddenGlobs = [
  new RegExp(`\\.${"tran"}${"script"}\\.`),
  /\.chat\./,
  /\.prompt\./,
  /\.scratch\./,
  /\.vsix$/,
  /\.npmrc$/
];

for (const entry of forbiddenPaths) {
  if (await isTracked(entry)) {
    failures.push(`forbidden path present: ${entry}`);
  }
}

for (const file of await listFiles(root)) {
  const relative = path.relative(root, file).replace(/\\/g, "/");
  if (forbiddenGlobs.some((pattern) => pattern.test(relative))) {
    failures.push(`forbidden file present: ${relative}`);
  }
  if (relative.startsWith("src/") && relative.endsWith(".ts")) {
    const text = await fs.readFile(file, "utf8");
    for (const pattern of [/console\.(log|debug)\(/, /\bdebugger\b/, /\b(TODO|FIXME|HACK|TEMP|XXX)\b/]) {
      if (pattern.test(text)) {
        failures.push(`production code contains forbidden pattern ${pattern}: ${relative}`);
      }
    }
  }
  if (relative.startsWith(".github/workflows/") && (relative.endsWith(".yml") || relative.endsWith(".yaml"))) {
    await lintWorkflow(file, relative);
  }
}

await lintActionMetadata();

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}

async function lintActionMetadata() {
  const action = YAML.parse(await fs.readFile(path.join(root, "action.yml"), "utf8"));
  if (action?.runs?.using !== "node24") {
    failures.push("action.yml must use node24");
  }
  for (const key of ["name", "description", "author", "branding", "inputs", "outputs", "runs"]) {
    if (!Object.hasOwn(action, key)) {
      failures.push(`action.yml missing ${key}`);
    }
  }
}

async function lintWorkflow(file, relative) {
  const text = await fs.readFile(file, "utf8");
  if (text.includes("pull_request_target")) {
    failures.push(`${relative} uses forbidden pull_request_target`);
  }
  if (/\bubuntu-latest\b/.test(text)) {
    failures.push(`${relative} uses ubuntu-latest`);
  }
  if (/if:\s*(\$\{\{\s*)?true\s*(\}\})?/.test(text)) {
    failures.push(`${relative} contains if: true`);
  }
  const uses = [...text.matchAll(/uses:\s*([^\s#]+)/g)].map((match) => match[1].replace(/^['"]|['"]$/g, ""));
  for (const value of uses) {
    if (value.startsWith("./") || value.startsWith("docker://")) {
      continue;
    }
    const ref = value.split("@")[1];
    if (!ref || !/^[a-f0-9]{40}$/i.test(ref)) {
      failures.push(`${relative} has unpinned action reference: ${value}`);
    }
  }
}

async function listFiles(start) {
  const ignored = new Set([".git", "node_modules", "coverage", "build", ".venv"]);
  const results = [];
  async function walk(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignored.has(entry.name)) {
          await walk(full);
        }
      } else if (entry.isFile()) {
        results.push(full);
      }
    }
  }
  await walk(start);
  return results;
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function isTracked(entry) {
  const tracked = await runGit(["ls-files", entry]);
  return tracked.trim() !== "";
}

async function runGit(args) {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve) => {
    const child = spawn("git", args, { shell: false, windowsHide: true });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.on("error", () => resolve(""));
    child.on("close", () => resolve(stdout));
  });
}
