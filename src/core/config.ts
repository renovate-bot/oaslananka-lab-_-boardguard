import path from "node:path";
import YAML from "yaml";
import { pathExists, readTextFile } from "../util/fs.js";
import { resolveFrom } from "../util/paths.js";
import type { ManufacturingPlan } from "./types.js";
import { isSeverityName, type SeverityName } from "./severities.js";
import type { RuleId } from "./findings.js";

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
  if (config.version !== undefined && config.version !== 1) {
    errors.push("version must be 1");
  }
  if (config.project?.path !== undefined && typeof config.project.path !== "string") {
    errors.push("project.path must be a string");
  }
  if (config.rules) {
    for (const [ruleId, severity] of Object.entries(config.rules)) {
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
