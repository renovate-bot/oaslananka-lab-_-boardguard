import fs from "node:fs/promises";
import YAML from "yaml";

const action = YAML.parse(await fs.readFile("action.yml", "utf8"));
const requiredInputs = [
  "path",
  "project",
  "config",
  "mode",
  "require-kicad",
  "kicad-cli",
  "bom",
  "pinmap",
  "sarif",
  "json",
  "markdown",
  "upload-sarif",
  "upload-artifacts"
];
const requiredOutputs = [
  "findings",
  "critical",
  "high",
  "medium",
  "low",
  "sarif-path",
  "json-path",
  "markdown-path",
  "project-count",
  "kicad-cli-found",
  "erc-status",
  "drc-status"
];
const failures = [];
for (const key of ["name", "description", "author", "branding", "inputs", "outputs", "runs"]) {
  if (!Object.hasOwn(action, key)) {
    failures.push(`missing ${key}`);
  }
}
if (action.runs?.using !== "node24") {
  failures.push("runs.using must be node24");
}
if (action.runs?.main !== "dist/index.cjs") {
  failures.push("runs.main must be dist/index.cjs");
}
for (const input of requiredInputs) {
  if (!action.inputs?.[input]) {
    failures.push(`missing input ${input}`);
  }
}
for (const output of requiredOutputs) {
  if (!action.outputs?.[output]) {
    failures.push(`missing output ${output}`);
  }
}
try {
  await fs.access("dist/index.cjs");
} catch {
  failures.push("dist/index.cjs is missing; run pnpm run action:build");
}
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
