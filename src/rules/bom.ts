import path from "node:path";
import { configuredSeverity, type BoardGuardConfig } from "../core/config.js";
import { makeFinding, type Finding } from "../core/findings.js";
import type { ComponentRecord, ProjectDiscovery } from "../core/types.js";
import { parseBomCsv } from "../bom/bom.js";
import { parseSchematic } from "../kicad/schematic.js";
import { pathExists } from "../util/fs.js";
import { normalizeRelative, resolveFrom } from "../util/paths.js";

export async function bomFindings(root: string, projects: ProjectDiscovery[], bomInput: string | undefined, config?: BoardGuardConfig): Promise<Finding[]> {
  const schematicComponents: ComponentRecord[] = [];
  const parsedSchematicFiles = new Set<string>();
  for (const project of projects) {
    for (const schematic of project.schematicFiles) {
      const normalizedSchematic = path.resolve(schematic);
      if (parsedSchematicFiles.has(normalizedSchematic)) {
        continue;
      }
      parsedSchematicFiles.add(normalizedSchematic);
      const parsed = await parseSchematic(schematic);
      if (parsed.valid) {
        schematicComponents.push(...parsed.components);
      }
    }
  }

  const configuredBom = bomInput ?? config?.bom?.input;
  const bomComponents: ComponentRecord[] = [];
  if (configuredBom) {
    const bomPath = resolveFrom(root, configuredBom);
    if (await pathExists(bomPath)) {
      bomComponents.push(...await parseBomCsv(bomPath));
    }
  }

  const findings: Finding[] = [];
  findings.push(...duplicateFindings(root, schematicComponents, "schematic", config));
  findings.push(...duplicateFindings(root, bomComponents, "BOM", config));
  const reportedQuantityRows = new Set<string>();

  for (const component of [...schematicComponents, ...bomComponents]) {
    if (component.dnp) {
      continue;
    }
    if (component.source === "bom") {
      for (const required of config?.bom?.required_fields ?? []) {
        if (!hasField(component.rawFields, required)) {
          findings.push(applyConfigured(config, makeFinding({
            ruleId: "BG-BOM-001",
            message: `BOM row for ${component.reference} is missing required field ${required}.`,
            locations: [locationFor(root, component)]
          })));
        }
      }
      if (component.rowQuantity !== undefined && component.rowReferences && component.rowQuantity !== component.rowReferences.length) {
        const rowKey = `${component.sourcePath}:${component.line ?? 0}:${component.rowReferences.join(" ")}`;
        if (!reportedQuantityRows.has(rowKey)) {
          reportedQuantityRows.add(rowKey);
          findings.push(applyConfigured(config, makeFinding({
            ruleId: "BG-BOM-001",
            message: `BOM row for ${component.rowReferences.join(", ")} declares quantity ${component.rowQuantity} but lists ${component.rowReferences.length} designators.`,
            locations: [locationFor(root, component)]
          })));
        }
      }
    }
    if (!component.manufacturer || !component.mpn) {
      findings.push(applyConfigured(config, makeFinding({
        ruleId: "BG-BOM-001",
        message: `${component.source === "bom" ? "BOM row" : "Schematic component"} ${component.reference} is missing manufacturer or MPN metadata.`,
        locations: [locationFor(root, component)]
      })));
    }
    if (!component.value || !component.footprint) {
      findings.push(applyConfigured(config, makeFinding({
        ruleId: "BG-BOM-001",
        message: `${component.source === "bom" ? "BOM row" : "Schematic component"} ${component.reference} is missing value or footprint metadata.`,
        locations: [locationFor(root, component)]
      })));
    }
  }

  if (bomComponents.length > 0) {
    const schematicRefs = new Set(schematicComponents.filter((component) => !component.dnp).map((component) => component.reference));
    const bomRefs = new Set(bomComponents.filter((component) => !component.dnp).map((component) => component.reference));
    for (const component of schematicComponents.filter((entry) => !entry.dnp && !bomRefs.has(entry.reference))) {
      findings.push(applyConfigured(config, makeFinding({
        ruleId: "BG-BOM-001",
        message: `Schematic component ${component.reference} is missing from the BOM.`,
        locations: [locationFor(root, component)]
      })));
    }
    for (const component of bomComponents.filter((entry) => !entry.dnp && !schematicRefs.has(entry.reference))) {
      findings.push(applyConfigured(config, makeFinding({
        ruleId: "BG-BOM-001",
        message: `BOM row ${component.reference} does not match a parsed schematic component.`,
        locations: [locationFor(root, component)]
      })));
    }
  }
  return findings.filter((finding) => configuredSeverity(config, finding.ruleId) !== "off").sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.message.localeCompare(b.message));
}

function duplicateFindings(root: string, components: ComponentRecord[], label: string, config?: BoardGuardConfig): Finding[] {
  const findings: Finding[] = [];
  const seen = new Map<string, ComponentRecord>();
  for (const component of components) {
    const previous = seen.get(component.reference);
    if (previous) {
      findings.push(applyConfigured(config, makeFinding({
        ruleId: "BG-BOM-002",
        message: `Duplicate ${label} designator ${component.reference} was found.`,
        locations: [
          locationFor(root, previous),
          locationFor(root, component)
        ]
      })));
    } else {
      seen.set(component.reference, component);
    }
  }
  return findings;
}

function locationFor(root: string, component: ComponentRecord) {
  return {
    path: normalizeRelative(root, path.resolve(component.sourcePath)),
    line: component.line ?? 1,
    column: 1
  };
}

function hasField(row: Record<string, string> | undefined, field: string): boolean {
  if (!row) {
    return false;
  }
  const wanted = field.trim().toLowerCase();
  return Object.entries(row).some(([key, value]) => key.trim().toLowerCase() === wanted && value.trim() !== "");
}

function applyConfigured(config: BoardGuardConfig | undefined, finding: Finding): Finding {
  const severity = configuredSeverity(config, finding.ruleId);
  if (!severity || severity === "off") {
    return finding;
  }
  return { ...finding, severity };
}
