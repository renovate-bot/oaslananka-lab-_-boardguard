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

export interface ListFileOptions {
  maxDepth?: number;
  maxFiles?: number;
  maxFileSizeBytes?: number;
  allowedExtensions?: readonly string[];
  ignoredDirectories?: ReadonlySet<string>;
}

const defaultListOptions = {
  maxDepth: 8,
  maxFiles: 10_000,
  maxFileSizeBytes: 10 * 1024 * 1024
};

export async function pathExists(value: string): Promise<boolean> {
  try {
    await fs.access(value);
    return true;
  } catch {
    return false;
  }
}

export async function readTextFile(value: string): Promise<string> {
  const stat = await fs.stat(value);
  if (stat.size > defaultListOptions.maxFileSizeBytes) {
    throw new Error(`file exceeds ${defaultListOptions.maxFileSizeBytes} byte limit`);
  }
  return fs.readFile(value, "utf8");
}

export async function writeTextFile(value: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(value), { recursive: true });
  await fs.writeFile(value, content, "utf8");
}

export async function listFiles(root: string, predicate: (file: string) => boolean, options: ListFileOptions = {}): Promise<string[]> {
  const results: string[] = [];
  const ignored = options.ignoredDirectories ?? ignoredDirectories;
  const allowedExtensions = options.allowedExtensions ? new Set(options.allowedExtensions) : undefined;
  const maxDepth = options.maxDepth ?? defaultListOptions.maxDepth;
  const maxFiles = options.maxFiles ?? defaultListOptions.maxFiles;
  const maxFileSizeBytes = options.maxFileSizeBytes ?? defaultListOptions.maxFileSizeBytes;

  async function walk(directory: string, depth: number): Promise<void> {
    if (depth > maxDepth || results.length >= maxFiles) {
      return;
    }
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (results.length >= maxFiles) {
        return;
      }
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        continue;
      }
      if (entry.isDirectory()) {
        if (!ignored.has(entry.name)) {
          await walk(full, depth + 1);
        }
        continue;
      }
      if (entry.isFile() && (!allowedExtensions || allowedExtensions.has(path.extname(entry.name))) && predicate(full)) {
        const stat = await fs.stat(full);
        if (stat.size > maxFileSizeBytes) {
          continue;
        }
        results.push(full);
      }
    }
  }

  await walk(root, 0);
  return results;
}
