import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const output = process.argv[2] ?? "boardguard-results/sbom.cdx.json";
await fs.mkdir(path.dirname(output), { recursive: true });

const result = runCommand("corepack", [
  "pnpm",
  "exec",
  "cyclonedx-npm",
  "--ignore-npm-errors",
  "--spec-version",
  "1.6",
  "--output-reproducible",
  "--output-format",
  "JSON",
  "--output-file",
  output,
  "--validate"
]);

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || "CycloneDX SBOM generation failed.\n");
  process.exitCode = result.status ?? 1;
}

function runCommand(command, args) {
  const invocation = process.platform === "win32"
    ? { command: "cmd.exe", args: ["/d", "/c", command, ...args] }
    : { command, args };
  return spawnSync(invocation.command, invocation.args, { encoding: "utf8" });
}
