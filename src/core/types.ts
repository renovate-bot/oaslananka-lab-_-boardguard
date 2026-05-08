import type { Finding } from "./findings.js";
import type { SeverityName } from "./severities.js";

export type ScanMode = "warn" | "enforce";
export type ReportFormat = "json" | "sarif" | "markdown";
export type CheckStatus = "skipped" | "unavailable" | "passed" | "failed";

export interface AnalyzeOptions {
  path: string;
  project?: string;
  config?: string;
  mode: ScanMode;
  requireKicad: boolean;
  kicadCli?: string;
  bom?: string;
  pinmap?: string;
  exportPlan: boolean;
}

export interface ProjectDiscovery {
  projectFile: string;
  root: string;
  schematicFiles: string[];
  boardFiles: string[];
}

export interface ComponentRecord {
  reference: string;
  value?: string;
  footprint?: string;
  manufacturer?: string;
  mpn?: string;
  sourcePath: string;
  line?: number;
}

export interface PinmapEntry {
  designator: string;
  pin: string;
  net: string;
  firmware?: string;
}

export interface ManufacturingPlan {
  boardName?: string;
  revision?: string;
  outputDir?: string;
  expectedArtifacts: Record<string, boolean | undefined>;
}

export interface KicadCliResult {
  found: boolean;
  path?: string;
  version?: string;
  ercStatus: CheckStatus;
  drcStatus: CheckStatus;
}

export interface ReportCounts {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface BoardGuardReport {
  schemaVersion: 1;
  tool: {
    name: "boardguard";
    version: string;
  };
  mode: ScanMode;
  projectCount: number;
  projects: ProjectDiscovery[];
  kicad: KicadCliResult;
  counts: ReportCounts;
  maxSeverity: SeverityName | "none";
  findings: Finding[];
  exportPlan?: ManufacturingPlan;
}
