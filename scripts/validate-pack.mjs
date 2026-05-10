import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";

const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));
const manifest = JSON.parse(await fs.readFile(".release-please-manifest.json", "utf8"));
const failures = [];

await requireFile("dist/cli/main.js");
await requireFile("dist/index.cjs");
await requireFile("README.md");
await requireFile("LICENSE");
await requireFile("SECURITY.md");
await requireFile("action.yml");
await requireFile("boardguard.schema.json");

const cli = await readFileIfPresent("dist/cli/main.js");
if (cli !== undefined && !cli.startsWith("#!/usr/bin/env node")) {
  failures.push("dist/cli/main.js must start with a Node shebang");
}

if (packageJson.bin?.boardguard !== "./dist/cli/main.js") {
  failures.push("package.json bin.boardguard must point to ./dist/cli/main.js");
}
if (packageJson.version !== manifest["."]) {
  failures.push("package.json version must match .release-please-manifest.json");
}

const versionModule = await readFileIfPresent("src/generated/version.ts");
if (versionModule === undefined) {
  failures.push("src/generated/version.ts is missing");
} else if (!versionModule.includes(`"${packageJson.version}"`)) {
  failures.push("src/generated/version.ts must match package.json version");
}

const packOutput = runCommand("npm", ["pack", "--dry-run", "--json"]);
const files = new Set();
if (packOutput) {
  try {
    const [pack] = JSON.parse(packOutput);
    for (const file of pack.files) {
      files.add(file.path.replace(/\\/g, "/"));
    }
  } catch (error) {
    failures.push(`npm pack output could not be parsed: ${error instanceof Error ? error.message : "invalid JSON"}`);
  }
}
const required = [
  "dist/cli/main.js",
  "dist/index.cjs",
  "package.json",
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "action.yml",
  "boardguard.schema.json"
];
for (const file of required) {
  if (files.size > 0 && !files.has(file)) {
    failures.push(`package tarball is missing ${file}`);
  }
}

const forbiddenPatterns = [
  /^node_modules\//,
  /^coverage\//,
  /^boardguard-results\//,
  /^\.git\//,
  /^\.codex\//,
  /^\.claude\//,
  /^\.agent\//,
  /(^|\/)(prompt|prompts|scratch|chat|instructions)\.md$/i,
  /\.(transcript|chat|prompt|scratch)\./i
];
for (const file of files) {
  if (forbiddenPatterns.some((pattern) => pattern.test(file))) {
    failures.push(`package tarball includes forbidden file ${file}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}

async function requireFile(file) {
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile()) {
      failures.push(`${file} must be a file`);
    }
  } catch {
    failures.push(`${file} is missing`);
  }
}

async function readFileIfPresent(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return undefined;
  }
}

function runCommand(command, args) {
  const invocation = process.platform === "win32"
    ? { command: "cmd.exe", args: ["/d", "/c", command, ...args] }
    : { command, args };
  const result = spawnSync(invocation.command, invocation.args, { encoding: "utf8" });
  if (result.status !== 0) {
    failures.push(`${command} ${args.join(" ")} failed\n${result.stderr}`);
    return "";
  }
  return result.stdout;
}
