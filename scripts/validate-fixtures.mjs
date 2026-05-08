import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const update = process.argv.includes("--update");
const root = process.cwd();
const projectsRoot = path.join(root, "tests", "fixtures", "projects");
const expectedRoot = path.join(root, "tests", "fixtures", "expected");
const fixtureNames = [
  "safe-basic",
  "missing-board",
  "missing-schematic",
  "multiple-projects",
  "malformed",
  "bom-missing-mpn",
  "pinmap-mismatch"
];
const failures = [];

await fs.mkdir(expectedRoot, { recursive: true });
for (const fixture of fixtureNames) {
  const fixturePath = path.join(projectsRoot, fixture);
  const expectedPath = path.join(expectedRoot, `${fixture}.json`);
  const args = ["dist/cli/main.js", "scan", "--path", fixturePath, "--format", "json", "--kicad-cli", missingKicadPath()];
  const bomPath = path.join(fixturePath, "bom.csv");
  const pinmapPath = path.join(fixturePath, "firmware-pins.yml");
  if (await exists(bomPath)) {
    args.push("--bom", "bom.csv");
  }
  if (await exists(pinmapPath)) {
    args.push("--pinmap", "firmware-pins.yml");
  }
  const result = await run("node", args);
  if (result.code !== 0) {
    failures.push(`${fixture}: scan exited ${result.code}\n${result.stderr}`);
    continue;
  }
  const normalized = `${JSON.stringify(JSON.parse(result.stdout), null, 2)}\n`;
  if (update) {
    await fs.writeFile(expectedPath, normalized, "utf8");
    continue;
  }
  let expected;
  try {
    expected = await fs.readFile(expectedPath, "utf8");
  } catch {
    failures.push(`${fixture}: expected report missing`);
    continue;
  }
  if (normalized !== expected) {
    failures.push(`${fixture}: report differs from expected`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
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
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function missingKicadPath() {
  return path.join(root, "tests", "fixtures", "missing-tools", "kicad-cli-not-installed");
}
