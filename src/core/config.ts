import path from "node:path";
import YAML from "yaml";
import { pathExists, readTextFile } from "../util/fs.js";
import { resolveFrom } from "../util/paths.js";
import type { ManufacturingPlan } from "./types.js";
import { isSeverityName, type SeverityName } from "./severities.js";
import { ruleDefinitions, type Finding, type RuleId } from "./findings.js";

export interface BoardGuardConfig {
  version?: number;
  project?: {
    path?: string;
    require_kicad_cli?: boolean;
  };
  reports?: {
    json?: boolean;
    sarif?: boolean;
    markdown?: boolean;
  };
  manufacturing?: {
    board_name?: string;
    revision?: string;
    output_dir?: string;
    expected_artifacts?: Record<string, boolean>;
  };
  bom?: {
    input?: string;
    required_fields?: string[];
  };
  firmware?: {
    pinmap?: string;
  };
  kicad?: {
    enabled?: boolean;
    min_version?: string;
    drc?: {
      severity?: "all" | "error" | "warning";
      schematic_parity?: boolean;
      refill_zones?: boolean;
      severity_exclusions?: boolean;
    };
    erc?: {
      severity?: "all" | "error" | "warning";
      severity_exclusions?: boolean;
    };
  };
  rules?: Partial<Record<RuleId, SeverityName | "error" | "warning" | "off">>;
}

export interface LoadedConfig {
  config?: BoardGuardConfig;
  path?: string;
  errors: string[];
}

export async function loadConfig(scanRoot: string, configInput?: string): Promise<LoadedConfig> {
  const candidate = configInput ? resolveFrom(scanRoot, configInput) : path.join(scanRoot, "boardguard.yml");
  if (!(await pathExists(candidate))) {
    return { errors: [] };
  }

  try {
    const text = await readTextFile(candidate);
    const parsed = YAML.parse(text) as BoardGuardConfig | null;
    if (!parsed || typeof parsed !== "object") {
      return { path: candidate, errors: ["configuration must be a YAML object"] };
    }
    const errors = validateConfig(parsed);
    return { config: parsed, path: candidate, errors };
  } catch (error) {
    return { path: candidate, errors: [error instanceof Error ? error.message : "configuration could not be parsed"] };
  }
}

export function validateConfig(config: BoardGuardConfig): string[] {
  const errors: string[] = [];
  if (!isPlainObject(config)) {
    return ["configuration must be an object"];
  }

  const root = config as Record<string, unknown>;
  allowKeys(root, ["version", "project", "reports", "manufacturing", "bom", "firmware", "kicad", "rules"], "config", errors);
  if (root.version !== undefined && root.version !== 1) {
    errors.push("version must be 1");
  }

  const project = root.project;
  if (project !== undefined) {
    if (!isPlainObject(project)) {
      errors.push("project must be an object");
    } else {
      allowKeys(project, ["path", "require_kicad_cli"], "project", errors);
      validateOptionalString(project.path, "project.path", errors);
      validateOptionalBoolean(project.require_kicad_cli, "project.require_kicad_cli", errors);
    }
  }

  const reports = root.reports;
  if (reports !== undefined) {
    if (!isPlainObject(reports)) {
      errors.push("reports must be an object");
    } else {
      allowKeys(reports, ["json", "sarif", "markdown"], "reports", errors);
      validateOptionalBoolean(reports.json, "reports.json", errors);
      validateOptionalBoolean(reports.sarif, "reports.sarif", errors);
      validateOptionalBoolean(reports.markdown, "reports.markdown", errors);
    }
  }

  const manufacturing = root.manufacturing;
  if (manufacturing !== undefined) {
    if (!isPlainObject(manufacturing)) {
      errors.push("manufacturing must be an object");
    } else {
      allowKeys(manufacturing, ["board_name", "revision", "output_dir", "expected_artifacts"], "manufacturing", errors);
      validateOptionalString(manufacturing.board_name, "manufacturing.board_name", errors);
      validateOptionalString(manufacturing.revision, "manufacturing.revision", errors);
      validateOptionalString(manufacturing.output_dir, "manufacturing.output_dir", errors);
      if (manufacturing.expected_artifacts !== undefined) {
        if (!isPlainObject(manufacturing.expected_artifacts)) {
          errors.push("manufacturing.expected_artifacts must be an object");
        } else {
          for (const [key, value] of Object.entries(manufacturing.expected_artifacts)) {
            if (typeof value !== "boolean") {
              errors.push(`manufacturing.expected_artifacts.${key} must be a boolean`);
            }
          }
        }
      }
    }
  }

  const bom = root.bom;
  if (bom !== undefined) {
    if (!isPlainObject(bom)) {
      errors.push("bom must be an object");
    } else {
      allowKeys(bom, ["input", "required_fields"], "bom", errors);
      validateOptionalString(bom.input, "bom.input", errors);
      if (bom.required_fields !== undefined && (!Array.isArray(bom.required_fields) || bom.required_fields.some((entry) => typeof entry !== "string" || entry.trim() === ""))) {
        errors.push("bom.required_fields must be an array of non-empty strings");
      }
    }
  }

  const firmware = root.firmware;
  if (firmware !== undefined) {
    if (!isPlainObject(firmware)) {
      errors.push("firmware must be an object");
    } else {
      allowKeys(firmware, ["pinmap"], "firmware", errors);
      validateOptionalString(firmware.pinmap, "firmware.pinmap", errors);
    }
  }

  const kicad = root.kicad;
  if (kicad !== undefined) {
    if (!isPlainObject(kicad)) {
      errors.push("kicad must be an object");
    } else {
      allowKeys(kicad, ["enabled", "min_version", "drc", "erc"], "kicad", errors);
      validateOptionalBoolean(kicad.enabled, "kicad.enabled", errors);
      validateOptionalString(kicad.min_version, "kicad.min_version", errors);
      if (kicad.drc !== undefined) {
        if (!isPlainObject(kicad.drc)) {
          errors.push("kicad.drc must be an object");
        } else {
          allowKeys(kicad.drc, ["severity", "schematic_parity", "refill_zones", "severity_exclusions"], "kicad.drc", errors);
          validateSeveritySelector(kicad.drc.severity, "kicad.drc.severity", errors);
          validateOptionalBoolean(kicad.drc.schematic_parity, "kicad.drc.schematic_parity", errors);
          validateOptionalBoolean(kicad.drc.refill_zones, "kicad.drc.refill_zones", errors);
          validateOptionalBoolean(kicad.drc.severity_exclusions, "kicad.drc.severity_exclusions", errors);
        }
      }
      if (kicad.erc !== undefined) {
        if (!isPlainObject(kicad.erc)) {
          errors.push("kicad.erc must be an object");
        } else {
          allowKeys(kicad.erc, ["severity", "severity_exclusions"], "kicad.erc", errors);
          validateSeveritySelector(kicad.erc.severity, "kicad.erc.severity", errors);
          validateOptionalBoolean(kicad.erc.severity_exclusions, "kicad.erc.severity_exclusions", errors);
        }
      }
    }
  }

  const rules = root.rules;
  if (rules !== undefined) {
    if (!isPlainObject(rules)) {
      errors.push("rules must be an object");
      return errors.sort();
    }
    const knownRuleIds = new Set(Object.keys(ruleDefinitions));
    for (const [ruleId, severity] of Object.entries(rules)) {
      if (!knownRuleIds.has(ruleId)) {
        errors.push(`rules.${ruleId} is not a known BoardGuard rule`);
        continue;
      }
      if (severity === "error" || severity === "warning" || severity === "off") {
        continue;
      }
      if (typeof severity !== "string" || !isSeverityName(severity)) {
        errors.push(`rules.${ruleId} must be a known severity, error, warning, or off`);
      }
    }
  }
  return errors.sort();
}

function allowKeys(row: Record<string, unknown>, allowed: string[], prefix: string, errors: string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(row)) {
    if (!allowedSet.has(key)) {
      errors.push(`${prefix}.${key} is not supported`);
    }
  }
}

export function configuredSeverity(config: BoardGuardConfig | undefined, ruleId: RuleId): SeverityName | "off" | undefined {
  const configured = config?.rules?.[ruleId];
  if (!configured) {
    return undefined;
  }
  if (configured === "error") {
    return "high";
  }
  if (configured === "warning") {
    return "medium";
  }
  return configured;
}

export function applyConfiguredFinding(finding: Finding, config?: BoardGuardConfig): Finding | undefined {
  const severity = configuredSeverity(config, finding.ruleId);
  if (severity === "off") {
    return undefined;
  }
  if (severity) {
    return { ...finding, severity };
  }
  return finding;
}

export function manufacturingPlan(config: BoardGuardConfig | undefined): ManufacturingPlan | undefined {
  const manufacturing = config?.manufacturing;
  if (!manufacturing) {
    return undefined;
  }
  return {
    boardName: manufacturing.board_name,
    revision: manufacturing.revision,
    outputDir: manufacturing.output_dir,
    expectedArtifacts: manufacturing.expected_artifacts ?? {}
  };
}

function validateOptionalBoolean(value: unknown, name: string, errors: string[]): void {
  if (value !== undefined && typeof value !== "boolean") {
    errors.push(`${name} must be a boolean`);
  }
}

function validateOptionalString(value: unknown, name: string, errors: string[]): void {
  if (value !== undefined && typeof value !== "string") {
    errors.push(`${name} must be a string`);
  }
}

function validateSeveritySelector(value: unknown, name: string, errors: string[]): void {
  if (value !== undefined && value !== "all" && value !== "error" && value !== "warning") {
    errors.push(`${name} must be all, error, or warning`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
