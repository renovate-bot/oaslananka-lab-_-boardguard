import { configuredSeverity, manufacturingPlan, type BoardGuardConfig } from "../core/config.js";
import { makeFinding, type Finding } from "../core/findings.js";
import type { ManufacturingPlan } from "../core/types.js";

const expectedArtifactKeys = ["gerber", "drill", "bom", "cpl", "schematic_pdf", "pcb_pdf", "step"] as const;

export function manufacturingFindings(config?: BoardGuardConfig): Finding[] {
  const plan = manufacturingPlan(config);
  if (!plan) {
    const severity = configuredSeverity(config, "BG-MFG-001");
    return severity === "off" ? [] : [makeFinding({
      ruleId: "BG-MFG-001",
      severity,
      message: "No boardguard.yml manufacturing release metadata was found.",
      locations: [{ path: "boardguard.yml", line: 1, column: 1 }]
    })];
  }

  const findings: Finding[] = [];
  const missingMetadata = [
    plan.boardName ? "" : "board_name",
    plan.revision ? "" : "revision",
    plan.outputDir ? "" : "output_dir"
  ].filter(Boolean);
  const metadataSeverity = configuredSeverity(config, "BG-MFG-001");
  if (missingMetadata.length > 0 && metadataSeverity !== "off") {
    findings.push(makeFinding({
      ruleId: "BG-MFG-001",
      severity: metadataSeverity,
      message: `Manufacturing metadata is missing: ${missingMetadata.join(", ")}.`,
      locations: [{ path: "boardguard.yml", line: 1, column: 1 }]
    }));
  }

  const missingPlan = expectedArtifactKeys.filter((key) => typeof plan.expectedArtifacts[key] !== "boolean");
  const planSeverity = configuredSeverity(config, "BG-MFG-002");
  if (missingPlan.length > 0 && planSeverity !== "off") {
    findings.push(makeFinding({
      ruleId: "BG-MFG-002",
      severity: planSeverity,
      message: `Manufacturing output plan is missing artifact flags: ${missingPlan.join(", ")}.`,
      locations: [{ path: "boardguard.yml", line: 1, column: 1 }]
    }));
  }
  return findings;
}

export function exportPlan(config?: BoardGuardConfig): ManufacturingPlan | undefined {
  return manufacturingPlan(config);
}
