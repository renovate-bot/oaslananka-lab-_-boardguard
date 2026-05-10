import { applyConfiguredFinding, manufacturingPlan, type BoardGuardConfig } from "../core/config.js";
import { makeFinding, type Finding } from "../core/findings.js";
import type { ManufacturingPlan } from "../core/types.js";

const expectedArtifactKeys = ["gerber", "drill", "bom", "cpl", "schematic_pdf", "pcb_pdf", "step"] as const;

export function manufacturingFindings(config?: BoardGuardConfig): Finding[] {
  const plan = manufacturingPlan(config);
  if (!plan) {
    const finding = applyConfiguredFinding(makeFinding({
      ruleId: "BG-MFG-001",
      message: "No boardguard.yml manufacturing release metadata was found.",
      locations: [{ path: "boardguard.yml", line: 1, column: 1 }]
    }), config);
    return finding ? [finding] : [];
  }

  const findings: Finding[] = [];
  const missingMetadata = [
    plan.boardName ? "" : "board_name",
    plan.revision ? "" : "revision",
    plan.outputDir ? "" : "output_dir"
  ].filter(Boolean);
  if (missingMetadata.length > 0) {
    pushConfigured(findings, makeFinding({
      ruleId: "BG-MFG-001",
      message: `Manufacturing metadata is missing: ${missingMetadata.join(", ")}.`,
      locations: [{ path: "boardguard.yml", line: 1, column: 1 }]
    }), config);
  }

  const missingPlan = expectedArtifactKeys.filter((key) => typeof plan.expectedArtifacts[key] !== "boolean");
  if (missingPlan.length > 0) {
    pushConfigured(findings, makeFinding({
      ruleId: "BG-MFG-002",
      message: `Manufacturing output plan is missing artifact flags: ${missingPlan.join(", ")}.`,
      locations: [{ path: "boardguard.yml", line: 1, column: 1 }]
    }), config);
  }
  return findings;
}

export function exportPlan(config?: BoardGuardConfig): ManufacturingPlan | undefined {
  return manufacturingPlan(config);
}

function pushConfigured(findings: Finding[], finding: Finding, config: BoardGuardConfig | undefined): void {
  const configured = applyConfiguredFinding(finding, config);
  if (configured) {
    findings.push(configured);
  }
}
