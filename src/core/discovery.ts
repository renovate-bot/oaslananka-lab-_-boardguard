import fs from "node:fs/promises";
import path from "node:path";
import { fileTooLarge, listFiles, pathExists } from "../util/fs.js";
import { resolveFrom } from "../util/paths.js";
import type { ProjectDiscovery } from "./types.js";
import { parseSchematic } from "../kicad/schematic.js";

export interface DiscoveryResult {
  scanRoot: string;
  explicit: boolean;
  projectFiles: string[];
  projects: ProjectDiscovery[];
  diagnostics: DiscoveryDiagnostic[];
}

export interface DiscoveryDiagnostic {
  path: string;
  message: string;
}

export async function discoverProjects(rootInput: string, explicitProject?: string): Promise<DiscoveryResult> {
  const scanRoot = path.resolve(rootInput);
  let projectFiles: string[];
  let explicit = false;

  if (explicitProject) {
    explicit = true;
    const projectPath = resolveFrom(scanRoot, explicitProject);
    if ((await pathExists(projectPath)) && projectPath.endsWith(".kicad_pro")) {
      projectFiles = [projectPath];
    } else {
      projectFiles = [];
    }
  } else {
    projectFiles = await listFiles(scanRoot, (file) => file.endsWith(".kicad_pro"), {
      allowedExtensions: [".kicad_pro"],
      maxDepth: 8
    });
  }

  projectFiles.sort((a, b) => a.localeCompare(b));
  const projects: ProjectDiscovery[] = [];
  const diagnostics: DiscoveryDiagnostic[] = [];
  for (const projectFile of projectFiles) {
    const root = path.dirname(projectFile);
    const base = path.basename(projectFile, ".kicad_pro");
    const siblingProjectBases = new Set(
      projectFiles
        .filter((file) => path.dirname(file) === root)
        .map((file) => path.basename(file, ".kicad_pro"))
    );
    const designFiles = await listFiles(root, (file) => {
      const parent = path.dirname(file);
      return parent === root && (file.endsWith(".kicad_sch") || file.endsWith(".kicad_pcb"));
    }, {
      allowedExtensions: [".kicad_sch", ".kicad_pcb"],
      maxDepth: 1
    });
    const schematicFiles = await associatedSchematicFiles(root, designFiles.filter((file) => file.endsWith(".kicad_sch")), base, siblingProjectBases, diagnostics);
    const boardFiles = associatedBoardFiles(designFiles.filter((file) => file.endsWith(".kicad_pcb")), base);
    projects.push({ projectFile, root, schematicFiles, boardFiles });
  }

  return { scanRoot, explicit, projectFiles, projects, diagnostics };
}

function scoreAssociated(base: string, file: string): number {
  return path.basename(file, path.extname(file)) === base ? 0 : 1;
}

function associatedBoardFiles(files: string[], base: string): string[] {
  const exact = files.filter((file) => scoreAssociated(base, file) === 0);
  return exact.length > 0 ? exact : files;
}

async function associatedSchematicFiles(root: string, files: string[], base: string, siblingProjectBases: Set<string>, diagnostics: DiscoveryDiagnostic[]): Promise<string[]> {
  const exact = files.filter((file) => scoreAssociated(base, file) === 0);
  if (exact.length === 0) {
    return files;
  }
  const sheets = files.filter((file) => {
    const fileBase = path.basename(file, path.extname(file));
    return fileBase === base || !siblingProjectBases.has(fileBase);
  });
  const hierarchy = await discoverSchematicHierarchy(exact[0], root, diagnostics);
  return uniqueByRealpathPreserve([...sheets, ...hierarchy]);
}

async function discoverSchematicHierarchy(rootSchematic: string, projectRoot: string, diagnostics: DiscoveryDiagnostic[]): Promise<string[]> {
  const files: string[] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const realProjectRoot = await safeRealpath(projectRoot);
  if (!realProjectRoot) {
    diagnostics.push({ path: projectRoot, message: "Project root is missing or inaccessible while resolving schematic hierarchy." });
    return [];
  }
  const projectRootRealPath = realProjectRoot;

  async function visit(file: string, isRoot = false): Promise<void> {
    const realFile = await safeRealpath(file);
    if (!realFile || !isInside(projectRootRealPath, realFile)) {
      diagnostics.push({ path: file, message: isRoot ? "Root schematic is missing or outside the project root." : "Referenced schematic sheet is missing or outside the project root." });
      return;
    }
    if (stack.has(realFile)) {
      diagnostics.push({ path: file, message: "Referenced schematic sheet cycle was detected." });
      return;
    }
    if (visited.has(realFile)) {
      return;
    }
    visited.add(realFile);
    stack.add(realFile);
    files.push(realFile);
    if (await fileTooLarge(realFile)) {
      stack.delete(realFile);
      return;
    }
    const parsed = await parseSchematic(realFile);
    if (!parsed.valid) {
      if (!isRoot) {
        diagnostics.push({ path: realFile, message: `Referenced schematic sheet could not be parsed: ${parsed.reason ?? "unknown error"}.` });
      }
      stack.delete(realFile);
      return;
    }
    for (const sheetFile of parsed.sheetFiles) {
      await visit(path.resolve(path.dirname(realFile), sheetFile));
    }
    stack.delete(realFile);
  }

  await visit(rootSchematic, true);
  return uniqueSorted(files);
}

async function safeRealpath(file: string): Promise<string | undefined> {
  try {
    return await fs.realpath(file);
  } catch {
    return undefined;
  }
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function uniqueSorted(files: string[]): string[] {
  return [...new Set(files)].sort((a, b) => a.localeCompare(b));
}

async function uniqueByRealpathPreserve(files: string[]): Promise<string[]> {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const file of files) {
    const key = await safeRealpath(file) ?? path.resolve(file);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(file);
    }
  }
  return unique;
}
