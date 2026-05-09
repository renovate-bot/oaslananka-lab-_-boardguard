import path from "node:path";
import { listFiles, pathExists } from "../util/fs.js";
import { resolveFrom } from "../util/paths.js";
import type { ProjectDiscovery } from "./types.js";

export interface DiscoveryResult {
  scanRoot: string;
  explicit: boolean;
  projectFiles: string[];
  projects: ProjectDiscovery[];
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
    const schematicFiles = associatedSchematicFiles(designFiles.filter((file) => file.endsWith(".kicad_sch")), base, siblingProjectBases);
    const boardFiles = associatedBoardFiles(designFiles.filter((file) => file.endsWith(".kicad_pcb")), base);
    projects.push({ projectFile, root, schematicFiles, boardFiles });
  }

  return { scanRoot, explicit, projectFiles, projects };
}

function scoreAssociated(base: string, file: string): number {
  return path.basename(file, path.extname(file)) === base ? 0 : 1;
}

function associatedBoardFiles(files: string[], base: string): string[] {
  const exact = files.filter((file) => scoreAssociated(base, file) === 0);
  return exact.length > 0 ? exact : files;
}

function associatedSchematicFiles(files: string[], base: string, siblingProjectBases: Set<string>): string[] {
  const exact = files.filter((file) => scoreAssociated(base, file) === 0);
  if (exact.length === 0) {
    return files;
  }
  const sheets = files.filter((file) => {
    const fileBase = path.basename(file, path.extname(file));
    return fileBase === base || !siblingProjectBases.has(fileBase);
  });
  return sheets;
}
