import { configuredSeverity, type BoardGuardConfig } from "../core/config.js";
import { makeFinding, type Finding } from "../core/findings.js";
import type { DiscoveryResult } from "../core/discovery.js";
import type { ProjectDiscovery } from "../core/types.js";
import { normalizeRelative } from "../util/paths.js";
import { validateProjectFile } from "../kicad/project.js";
import { parseSchematic } from "../kicad/schematic.js";
import { parsePcb } from "../kicad/pcb.js";

export async function projectFindings(discovery: DiscoveryResult, config?: BoardGuardConfig): Promise<Finding[]> {
  const findings: Finding[] = [];
  const root = discovery.scanRoot;
  if (discovery.projectFiles.length === 0) {
    findings.push(applyConfigured(config, makeFinding({
      ruleId: "BG-PROJ-001",
      message: "No .kicad_pro file was found under the configured scan path.",
      locations: [{ path: "." }]
    })));
    return findings;
  }

  if (!discovery.explicit && discovery.projectFiles.length > 1) {
    findings.push(applyConfigured(config, makeFinding({
      ruleId: "BG-PROJ-002",
      message: `${discovery.projectFiles.length} KiCad projects were found without an explicit project selection.`,
      locations: discovery.projectFiles.map((file) => ({ path: normalizeRelative(root, file), line: 1, column: 1 }))
    })));
  }

  for (const project of discovery.projects) {
    await validateProject(project, root, config, findings);
  }

  return findings.sort(compareFindings);
}

async function validateProject(project: ProjectDiscovery, root: string, config: BoardGuardConfig | undefined, findings: Finding[]): Promise<void> {
  const projectValidation = await validateProjectFile(project.projectFile);
  if (!projectValidation.ok) {
    findings.push(applyConfigured(config, makeFinding({
      ruleId: "BG-PROJ-004",
      message: `Project file is malformed or unreadable: ${projectValidation.reason ?? "unknown error"}.`,
      locations: [{ path: normalizeRelative(root, project.projectFile), line: 1, column: 1 }]
    })));
  }

  if (project.schematicFiles.length === 0 || project.boardFiles.length === 0) {
    const missing = [
      project.schematicFiles.length === 0 ? "schematic" : "",
      project.boardFiles.length === 0 ? "board" : ""
    ].filter(Boolean).join(" and ");
    findings.push(applyConfigured(config, makeFinding({
      ruleId: "BG-PROJ-003",
      message: `Project ${normalizeRelative(root, project.projectFile)} is missing an associated ${missing} file.`,
      locations: [{ path: normalizeRelative(root, project.projectFile), line: 1, column: 1 }]
    })));
  }

  for (const schematic of project.schematicFiles) {
    const parsed = await parseSchematic(schematic);
    if (!parsed.valid) {
      findings.push(applyConfigured(config, makeFinding({
        ruleId: "BG-PROJ-004",
        message: `Schematic file is malformed or unreadable: ${parsed.reason ?? "unknown error"}.`,
        locations: [{ path: normalizeRelative(root, schematic), line: 1, column: 1 }]
      })));
    }
  }

  for (const board of project.boardFiles) {
    const parsed = await parsePcb(board);
    if (!parsed.valid) {
      findings.push(applyConfigured(config, makeFinding({
        ruleId: "BG-PROJ-004",
        message: `PCB file is malformed or unreadable: ${parsed.reason ?? "unknown error"}.`,
        locations: [{ path: normalizeRelative(root, board), line: 1, column: 1 }]
      })));
    }
  }
}

function applyConfigured(config: BoardGuardConfig | undefined, finding: Finding): Finding {
  const severity = configuredSeverity(config, finding.ruleId);
  if (!severity || severity === "off") {
    return finding;
  }
  return { ...finding, severity };
}

function compareFindings(a: Finding, b: Finding): number {
  return a.ruleId.localeCompare(b.ruleId) || (a.locations[0]?.path ?? "").localeCompare(b.locations[0]?.path ?? "") || a.message.localeCompare(b.message);
}
