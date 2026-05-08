import path from "node:path";
import { loadConfig } from "./config.js";
import { discoverProjects } from "./discovery.js";
import type { AnalyzeOptions, BoardGuardReport, ReportCounts } from "./types.js";
import type { Finding } from "./findings.js";
import { isBlockingSeverity, maxSeverity, type SeverityName } from "./severities.js";
import { normalizeRelative, resolveFrom } from "../util/paths.js";
import { runKicadChecks } from "../kicad/cli.js";
import { projectFindings } from "../rules/project.js";
import { kicadAvailabilityFindings } from "../rules/kicad.js";
import { ercFindings } from "../rules/erc.js";
import { drcFindings } from "../rules/drc.js";
import { bomFindings } from "../rules/bom.js";
import { manufacturingFindings, exportPlan } from "../rules/manufacturing.js";
import { pinmapFindings } from "../rules/pinmap.js";
import { makeFinding } from "./findings.js";

export const boardGuardVersion = "0.1.0";

export async function analyze(input: AnalyzeOptions): Promise<BoardGuardReport> {
  const scanRoot = path.resolve(input.path);
  const loadedConfig = await loadConfig(scanRoot, input.config);
  const config = loadedConfig.config;
  const configuredProject = input.project || config?.project?.path;
  const requireKicad = input.requireKicad || config?.project?.require_kicad_cli === true;
  const discovery = await discoverProjects(scanRoot, configuredProject);
  const kicad = await runKicadChecks(discovery.projects, input.kicadCli);

  const findings: Finding[] = [];
  for (const error of loadedConfig.errors) {
    findings.push(makeFinding({
      ruleId: "BG-MFG-001",
      message: `BoardGuard configuration is invalid: ${error}.`,
      locations: [{ path: loadedConfig.path ? normalizeRelative(scanRoot, loadedConfig.path) : "boardguard.yml", line: 1, column: 1 }]
    }));
  }
  findings.push(...await projectFindings(discovery, config));
  findings.push(...kicadAvailabilityFindings(kicad.cli, requireKicad, config));
  findings.push(...ercFindings(scanRoot, kicad.findings, config));
  findings.push(...drcFindings(scanRoot, kicad.findings, config));
  findings.push(...await bomFindings(scanRoot, discovery.projects, input.bom, config));
  findings.push(...manufacturingFindings(config));
  findings.push(...await pinmapFindings(scanRoot, discovery.projects, input.pinmap, config));

  const normalizedProjects = discovery.projects.map((project) => ({
    projectFile: normalizeRelative(scanRoot, project.projectFile),
    root: normalizeRelative(scanRoot, project.root),
    schematicFiles: project.schematicFiles.map((file) => normalizeRelative(scanRoot, file)),
    boardFiles: project.boardFiles.map((file) => normalizeRelative(scanRoot, file))
  }));
  const normalizedFindings = findings.map((finding) => ({
    ...finding,
    locations: finding.locations.map((location) => ({
      ...location,
      path: normalizeLocationPath(scanRoot, location.path)
    }))
  })).sort(compareFindings);
  const counts = countFindings(normalizedFindings);
  return {
    schemaVersion: 1,
    tool: {
      name: "boardguard",
      version: boardGuardVersion
    },
    mode: input.mode,
    projectCount: normalizedProjects.length,
    projects: normalizedProjects,
    kicad: {
      found: kicad.cli.found,
      path: kicad.cli.found ? "kicad-cli" : undefined,
      version: kicad.cli.version,
      ercStatus: kicad.cli.ercStatus,
      drcStatus: kicad.cli.drcStatus
    },
    counts,
    maxSeverity: normalizedFindings.reduce<SeverityName | "none">((current, finding) => current === "none" ? finding.severity : maxSeverity(current, finding.severity), "none"),
    findings: normalizedFindings,
    exportPlan: input.exportPlan ? exportPlan(config) : undefined
  };
}

export function shouldFail(report: BoardGuardReport, requireKicad = false): boolean {
  if (requireKicad && !report.kicad.found) {
    return true;
  }
  return report.mode === "enforce" && report.findings.some((finding) => isBlockingSeverity(finding.severity));
}

function countFindings(findings: Finding[]): ReportCounts {
  const counts: ReportCounts = {
    total: findings.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0
  };
  for (const finding of findings) {
    counts[finding.severity] += 1;
  }
  return counts;
}

function compareFindings(a: Finding, b: Finding): number {
  return a.ruleId.localeCompare(b.ruleId) || a.severity.localeCompare(b.severity) || (a.locations[0]?.path ?? "").localeCompare(b.locations[0]?.path ?? "") || a.message.localeCompare(b.message);
}

function normalizeLocationPath(root: string, value: string): string {
  if (value === "." || value === "boardguard.yml") {
    return value;
  }
  return path.isAbsolute(value) ? normalizeRelative(root, value) : normalizeRelative(root, resolveFrom(root, value));
}
