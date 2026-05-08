import fs from "node:fs/promises";
import path from "node:path";

const write = process.argv.includes("--write");
const ignored = new Set([".git", "node_modules", "coverage", "build", "dist", ".venv"]);
const textExtensions = new Set([
  ".ts",
  ".js",
  ".mjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".gitignore",
  ".gitattributes",
  ".editorconfig",
  ".csv",
  ".kicad_pro",
  ".kicad_sch",
  ".kicad_pcb"
]);

const failures = [];
for (const file of await listFiles(process.cwd())) {
  if (!isTextFile(file)) {
    continue;
  }
  const original = await fs.readFile(file, "utf8");
  const formatted = `${original.replace(/[ \t]+$/gm, "").replace(/\r\n/g, "\n").replace(/\s*$/u, "")}\n`;
  if (formatted !== original) {
    if (write) {
      await fs.writeFile(file, formatted, "utf8");
    } else {
      failures.push(path.relative(process.cwd(), file).replace(/\\/g, "/"));
    }
  }
}

if (failures.length > 0) {
  console.error(`Formatting issues found:\n${failures.join("\n")}`);
  process.exitCode = 1;
}

async function listFiles(root) {
  const results = [];
  async function walk(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!ignored.has(entry.name)) {
          await walk(path.join(directory, entry.name));
        }
      } else if (entry.isFile()) {
        results.push(path.join(directory, entry.name));
      }
    }
  }
  await walk(root);
  return results;
}

function isTextFile(file) {
  const name = path.basename(file);
  return textExtensions.has(path.extname(file)) || textExtensions.has(name);
}
