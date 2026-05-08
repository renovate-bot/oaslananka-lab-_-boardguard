import fs from "node:fs/promises";
import YAML from "yaml";

const file = process.argv[2] ?? "boardguard.yml";
const failures = [];
let config;
try {
  config = YAML.parse(await fs.readFile(file, "utf8"));
} catch (error) {
  failures.push(error instanceof Error ? error.message : "configuration could not be parsed");
}

if (config) {
  if (config.version !== 1) {
    failures.push("version must be 1");
  }
  const manufacturing = config.manufacturing;
  for (const key of ["board_name", "revision", "output_dir"]) {
    if (!manufacturing?.[key]) {
      failures.push(`manufacturing.${key} is required`);
    }
  }
  const expected = manufacturing?.expected_artifacts ?? {};
  for (const key of ["gerber", "drill", "bom", "cpl", "schematic_pdf", "pcb_pdf", "step"]) {
    if (typeof expected[key] !== "boolean") {
      failures.push(`manufacturing.expected_artifacts.${key} must be boolean`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
