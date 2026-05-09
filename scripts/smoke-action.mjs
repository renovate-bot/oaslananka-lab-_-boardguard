import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "boardguard-action-smoke-"));

try {
  await fs.cp(path.join(root, "tests", "fixtures", "projects", "safe-basic"), workspace, { recursive: true });
  const outputFile = path.join(workspace, "github-output.txt");
  const summaryFile = path.join(workspace, "github-summary.md");
  const env = {
    ...process.env,
    GITHUB_WORKSPACE: workspace,
    GITHUB_OUTPUT: outputFile,
    GITHUB_STEP_SUMMARY: summaryFile,
    INPUT_PATH: ".",
    INPUT_CONFIG: "boardguard.yml",
    INPUT_MODE: "warn",
    INPUT_REQUIRE_KICAD: "false",
    INPUT_KICAD_CLI: path.join(root, "tests", "fixtures", "missing-tools", "kicad-cli-not-installed"),
    INPUT_JSON: "true",
    INPUT_SARIF: "true",
    INPUT_MARKDOWN: "true",
    INPUT_UPLOAD_SARIF: "false",
    INPUT_UPLOAD_ARTIFACTS: "false"
  };
  const result = await run(process.execPath, [path.join(root, "dist", "index.cjs")], { cwd: root, env });
  if (result.code !== 0) {
    throw new Error(`Action smoke failed with code ${result.code}\n${result.stderr}`);
  }
  await requireFile(path.join(workspace, "boardguard-results", "boardguard.json"));
  await requireFile(path.join(workspace, "boardguard-results", "boardguard.sarif"));
  await requireFile(path.join(workspace, "boardguard-results", "boardguard.md"));
  const output = await fs.readFile(outputFile, "utf8");
  if (!output.includes("findings=") || !output.includes("project-count=1")) {
    throw new Error("Action smoke did not write expected GitHub outputs");
  }
} finally {
  await fs.rm(workspace, { recursive: true, force: true });
}

function run(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, shell: false, windowsHide: true });
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
    child.on("error", (error) => {
      resolve({ code: null, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function requireFile(file) {
  const stat = await fs.stat(file);
  if (!stat.isFile()) {
    throw new Error(`${file} is not a file`);
  }
}
