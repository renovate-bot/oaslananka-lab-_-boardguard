import fs from "node:fs/promises";
import path from "node:path";

const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "coverage",
  "build",
  "dist",
  ".venv",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache"
]);

export async function pathExists(value: string): Promise<boolean> {
  try {
    await fs.access(value);
    return true;
  } catch {
    return false;
  }
}

export async function readTextFile(value: string): Promise<string> {
  return fs.readFile(value, "utf8");
}

export async function writeTextFile(value: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(value), { recursive: true });
  await fs.writeFile(value, content, "utf8");
}

export async function listFiles(root: string, predicate: (file: string) => boolean): Promise<string[]> {
  const results: string[] = [];

  async function walk(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          await walk(full);
        }
        continue;
      }
      if (entry.isFile() && predicate(full)) {
        results.push(full);
      }
    }
  }

  await walk(root);
  return results;
}
