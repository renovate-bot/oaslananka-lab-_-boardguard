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
  maxFileSizeBytes: Number.POSITIVE_INFINITY
};

const fileSizeLimits = new Map<string, number>([
  [".kicad_pro", 2 * 1024 * 1024],
  [".kicad_sch", 50 * 1024 * 1024],
  [".kicad_pcb", 250 * 1024 * 1024],
  [".csv", 50 * 1024 * 1024],
  [".tsv", 50 * 1024 * 1024]
]);

const defaultReadLimitBytes = 10 * 1024 * 1024;

export class FileTooLargeError extends Error {
  constructor(
    readonly file: string,
    readonly size: number,
    readonly limit: number
  ) {
    super(`${file} exceeds ${limit} byte limit for ${path.extname(file) || "this file type"}`);
    this.name = "FileTooLargeError";
  }
}

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
  const limit = fileSizeLimitForPath(value);
  if (stat.size > limit) {
    throw new FileTooLargeError(value, stat.size, limit);
  }
  return fs.readFile(value, "utf8");
}

export function fileSizeLimitForPath(value: string): number {
  return fileSizeLimits.get(path.extname(value).toLowerCase()) ?? defaultReadLimitBytes;
}

export async function fileTooLarge(value: string): Promise<{ size: number; limit: number } | undefined> {
  let stat;
  try {
    stat = await fs.stat(value);
  } catch (error) {
    if (isMissingPathError(error)) {
      return undefined;
    }
    throw error;
  }
  const limit = fileSizeLimitForPath(value);
  return stat.size > limit ? { size: stat.size, limit } : undefined;
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
        if (Number.isFinite(maxFileSizeBytes)) {
          try {
            const stat = await fs.stat(full);
            if (stat.size > maxFileSizeBytes) {
              continue;
            }
          } catch (error) {
            if (isMissingPathError(error)) {
              continue;
            }
            throw error;
          }
        }
        results.push(full);
      }
    }
  }

  await walk(root, 0);
  return results;
}

function isMissingPathError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}
