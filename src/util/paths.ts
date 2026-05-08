import path from "node:path";

export function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

export function normalizeRelative(root: string, value: string): string {
  const relative = path.relative(root, value);
  const normalized = relative === "" ? "." : relative;
  return toPosixPath(normalized);
}

export function resolveFrom(base: string, value: string): string {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(base, value);
}
