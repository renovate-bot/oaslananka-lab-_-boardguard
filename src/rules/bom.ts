import path from "node:path";
import { configuredSeverity, type BoardGuardConfig } from "../core/config.js";
import { makeFinding, type Finding } from "../core/findings.js";
import type { ComponentRecord, ProjectDiscovery } from "../core/types.js";
import { parseBomCsv } from "../bom/bom.js";
import { parseSchematic } from "../kicad/schematic.js";
import { pathExists } from "../util/fs.js";
import { normalizeRelative, resolveFrom } from "../util/paths.js";

export async function bomFindings(root: string, projects: ProjectDiscovery[], bomInput: string | undefined, config?: BoardGuardConfig): Promise<Finding[]> {
  const components: ComponentRecord[] = [];
  for (const project of projects) {
    for (const schematic of project.schematicFiles) {
      const parsed = await parseSchematic(schematic);
      if (parsed.valid) {
        components.push(...parsed.components);
      }
    }
  }

  const configuredBom = bomInput ?? config?.bom?.input;
  if (configuredBom) {
    const bomPath = resolveFrom(root, configuredBom);
    if (await pathExists(bomPath)) {
      components.push(...await parseBomCsv(bomPath));
    }
  }

  const findings: Finding[] = [];
  const seen = new Map<string, ComponentRecord>();
  for (const component of components) {
    const previous = seen.get(component.reference);
    if (previous) {
      findings.push(applyConfigured(config, makeFinding({
        ruleId: "BG-BOM-002",
        message: `Duplicate component designator ${component.reference} was found.`,
        locations: [
          locationFor(root, previous),
          locationFor(root, component)
        ]
      })));
    } else {
      seen.set(component.reference, component);
    }

    if (!component.manufacturer || !component.mpn) {
      findings.push(applyConfigured(config, makeFinding({
        ruleId: "BG-BOM-001",
        message: `Component ${component.reference} is missing manufacturer or MPN metadata.`,
        locations: [locationFor(root, component)]
      })));
    }
    if (!component.value || !component.footprint) {
      findings.push(applyConfigured(config, makeFinding({
        ruleId: "BG-BOM-001",
        message: `Component ${component.reference} is missing value or footprint metadata.`,
        locations: [locationFor(root, component)]
      })));
    }
  }
  return findings.filter((finding) => configuredSeverity(config, finding.ruleId) !== "off").sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.message.localeCompare(b.message));
}

function locationFor(root: string, component: ComponentRecord) {
  return {
    path: normalizeRelative(root, path.resolve(component.sourcePath)),
    line: component.line ?? 1,
    column: 1
  };
}

function applyConfigured(config: BoardGuardConfig | undefined, finding: Finding): Finding {
  const severity = configuredSeverity(config, finding.ruleId);
  if (!severity || severity === "off") {
    return finding;
  }
  return { ...finding, severity };
}
