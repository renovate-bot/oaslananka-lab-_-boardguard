import fs from "node:fs/promises";
import path from "node:path";

const defaults: Record<string, string> = {
  path: ".",
  project: "",
  config: "boardguard.yml",
  mode: "warn",
  "require-kicad": "false",
  "kicad-cli": "",
  bom: "",
  pinmap: "",
  sarif: "true",
  json: "true",
  markdown: "true",
  "upload-sarif": "false",
  "upload-artifacts": "true"
};

export function actionInput(name: string): string {
  const keys = [
    `INPUT_${name.toUpperCase()}`,
    `INPUT_${name.replace(/-/g, "_").toUpperCase()}`
  ];
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value.trim() !== "") {
      return value.trim();
    }
  }
  return defaults[name] ?? "";
}

export function booleanActionInput(name: string): boolean {
  const value = actionInput(name).toLowerCase();
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`Input ${name} must be true or false.`);
}

export function modeActionInput(): "warn" | "enforce" {
  const value = actionInput("mode");
  if (value === "warn" || value === "enforce") {
    return value;
  }
  throw new Error("Input mode must be warn or enforce.");
}

export async function workspaceRoot(inputWorkspace = process.env.GITHUB_WORKSPACE ?? process.cwd()): Promise<string> {
  return fs.realpath(path.resolve(inputWorkspace));
}

export async function resolveWorkspacePath(workspace: string, value: string, inputName: string, mustExist = false): Promise<string> {
  if (value.trim() === "") {
    throw new Error(`Input ${inputName} must not be empty.`);
  }
  const root = await fs.realpath(path.resolve(workspace));
  const resolved = path.resolve(root, value);
  const existing = await realpathIfExists(resolved);
  if (mustExist && !existing) {
    throw new Error(`Input ${inputName} must point to an existing path.`);
  }
  const checked = existing ?? resolved;
  if (!isInside(root, checked)) {
    throw new Error(`Input ${inputName} must resolve inside GITHUB_WORKSPACE.`);
  }
  return checked;
}

export async function optionalWorkspacePath(workspace: string, value: string, inputName: string, mustExist = true): Promise<string | undefined> {
  return value.trim() === "" ? undefined : resolveWorkspacePath(workspace, value, inputName, mustExist);
}

export async function ensureWorkspaceDirectory(workspace: string, value: string, inputName: string): Promise<string> {
  const root = await fs.realpath(path.resolve(workspace));
  const resolved = path.resolve(root, value);
  await fs.mkdir(resolved, { recursive: true });
  const real = await fs.realpath(resolved);
  if (!isInside(root, real)) {
    throw new Error(`Input ${inputName} must resolve inside GITHUB_WORKSPACE.`);
  }
  return real;
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function realpathIfExists(value: string): Promise<string | undefined> {
  try {
    return await fs.realpath(value);
  } catch {
    return undefined;
  }
}
