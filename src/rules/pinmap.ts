import { applyConfiguredFinding, configuredSeverity, type BoardGuardConfig } from "../core/config.js";
import { makeFinding, type Finding } from "../core/findings.js";
import type { ProjectDiscovery } from "../core/types.js";
import { parseSchematic } from "../kicad/schematic.js";
import { loadPinmap } from "../pinmap/pinmap.js";
import { normalizeRelative, resolveFrom } from "../util/paths.js";

export async function pinmapFindings(root: string, projects: ProjectDiscovery[], pinmapInput: string | undefined, config?: BoardGuardConfig): Promise<Finding[]> {
  const configuredPinmap = pinmapInput ?? config?.firmware?.pinmap;
  if (!configuredPinmap || configuredSeverity(config, "BG-PIN-001") === "off") {
    return [];
  }
  const pinmapPath = resolveFrom(root, configuredPinmap);
  const loaded = await loadPinmap(pinmapPath);
  const findings: Finding[] = [];
  for (const error of loaded.errors) {
    pushConfigured(findings, makeFinding({
      ruleId: "BG-PIN-001",
      message: `Pinmap schema error: ${error}.`,
      locations: [{ path: normalizeRelative(root, pinmapPath), line: 1, column: 1 }]
    }), config);
  }
  const labels = new Set<string>();
  for (const project of projects) {
    for (const schematic of project.schematicFiles) {
      const parsed = await parseSchematic(schematic);
      if (parsed.valid) {
        parsed.netLabels.forEach((label) => labels.add(label));
      }
    }
  }
  if (labels.size === 0) {
    return findings;
  }
  for (const entry of loaded.entries) {
    if (!labels.has(entry.net)) {
      pushConfigured(findings, makeFinding({
        ruleId: "BG-PIN-001",
        message: `Pinmap net ${entry.net} for ${entry.designator}.${entry.pin} was not found in extracted schematic labels.`,
        locations: [{ path: normalizeRelative(root, pinmapPath), line: 1, column: 1 }]
      }), config);
    }
  }
  return findings.sort((a, b) => a.message.localeCompare(b.message));
}

function pushConfigured(findings: Finding[], finding: Finding, config: BoardGuardConfig | undefined): void {
  const configured = applyConfiguredFinding(finding, config);
  if (configured) {
    findings.push(configured);
  }
}
