import type { SeverityName } from "./severities.js";

export type RuleId =
  | "BG-CONFIG-001"
  | "BG-PROJ-001"
  | "BG-PROJ-002"
  | "BG-PROJ-003"
  | "BG-PROJ-004"
  | "BG-IO-TOO-LARGE"
  | "BG-KICAD-001"
  | "BG-ERC-001"
  | "BG-DRC-001"
  | "BG-BOM-001"
  | "BG-BOM-002"
  | "BG-MFG-001"
  | "BG-MFG-002"
  | "BG-PIN-001";

export interface RuleDefinition {
  id: RuleId;
  title: string;
  defaultSeverity: SeverityName;
  remediation: string;
  maturity: "implemented" | "partial" | "experimental";
}

export interface FindingLocation {
  path: string;
  line?: number;
  column?: number;
}

export interface Finding {
  ruleId: RuleId;
  title: string;
  severity: SeverityName;
  message: string;
  remediation: string;
  locations: FindingLocation[];
}

export const ruleDefinitions: Record<RuleId, RuleDefinition> = {
  "BG-CONFIG-001": {
    id: "BG-CONFIG-001",
    title: "BoardGuard configuration is invalid",
    defaultSeverity: "high",
    remediation: "Fix boardguard.yml so it matches the documented version 1 schema.",
    maturity: "implemented"
  },
  "BG-PROJ-001": {
    id: "BG-PROJ-001",
    title: "no KiCad project found",
    defaultSeverity: "high",
    remediation: "Set the project input to the directory containing the KiCad project or add a .kicad_pro file.",
    maturity: "implemented"
  },
  "BG-PROJ-002": {
    id: "BG-PROJ-002",
    title: "multiple KiCad projects found without explicit selection",
    defaultSeverity: "medium",
    remediation: "Set the project input to the intended .kicad_pro path.",
    maturity: "implemented"
  },
  "BG-PROJ-003": {
    id: "BG-PROJ-003",
    title: "KiCad project is missing schematic or board file",
    defaultSeverity: "high",
    remediation: "Add the missing design file or configure BoardGuard to scan the correct project path.",
    maturity: "implemented"
  },
  "BG-PROJ-004": {
    id: "BG-PROJ-004",
    title: "KiCad design file appears malformed or unreadable",
    defaultSeverity: "high",
    remediation: "Open and save the project in KiCad or restore the valid file.",
    maturity: "implemented"
  },
  "BG-IO-TOO-LARGE": {
    id: "BG-IO-TOO-LARGE",
    title: "design input exceeds BoardGuard safety limits",
    defaultSeverity: "high",
    remediation: "Reduce the file size or raise support for this file type before relying on BoardGuard results.",
    maturity: "implemented"
  },
  "BG-KICAD-001": {
    id: "BG-KICAD-001",
    title: "kicad-cli is unavailable",
    defaultSeverity: "medium",
    remediation: "Install KiCad CLI or configure kicad-cli-path.",
    maturity: "implemented"
  },
  "BG-ERC-001": {
    id: "BG-ERC-001",
    title: "KiCad ERC failed",
    defaultSeverity: "high",
    remediation: "Fix ERC violations in the schematic before merging.",
    maturity: "partial"
  },
  "BG-DRC-001": {
    id: "BG-DRC-001",
    title: "KiCad DRC failed",
    defaultSeverity: "high",
    remediation: "Fix DRC violations in the PCB before merging.",
    maturity: "partial"
  },
  "BG-BOM-001": {
    id: "BG-BOM-001",
    title: "component is missing manufacturer part metadata",
    defaultSeverity: "medium",
    remediation: "Add manufacturer and manufacturer part number metadata.",
    maturity: "partial"
  },
  "BG-BOM-002": {
    id: "BG-BOM-002",
    title: "duplicate component designator found",
    defaultSeverity: "high",
    remediation: "Re-annotate or correct duplicated designators.",
    maturity: "implemented"
  },
  "BG-MFG-001": {
    id: "BG-MFG-001",
    title: "manufacturing release metadata is missing",
    defaultSeverity: "medium",
    remediation: "Add boardguard.yml with board name, revision, output profile, and release artifact policy.",
    maturity: "implemented"
  },
  "BG-MFG-002": {
    id: "BG-MFG-002",
    title: "manufacturing output plan is incomplete",
    defaultSeverity: "medium",
    remediation: "Update boardguard.yml to declare expected manufacturing artifacts.",
    maturity: "implemented"
  },
  "BG-PIN-001": {
    id: "BG-PIN-001",
    title: "firmware pinmap is inconsistent with declared hardware mapping",
    defaultSeverity: "high",
    remediation: "Update firmware pinmap or schematic net labels to match.",
    maturity: "experimental"
  }
};

export function makeFinding(input: {
  ruleId: RuleId;
  severity?: SeverityName;
  message: string;
  locations?: FindingLocation[];
}): Finding {
  const rule = ruleDefinitions[input.ruleId];
  return {
    ruleId: input.ruleId,
    title: rule.title,
    severity: input.severity ?? rule.defaultSeverity,
    message: input.message,
    remediation: rule.remediation,
    locations: input.locations ?? []
  };
}
