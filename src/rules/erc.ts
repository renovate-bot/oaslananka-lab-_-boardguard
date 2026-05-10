import { applyConfiguredFinding, type BoardGuardConfig } from "../core/config.js";
import { makeFinding, type Finding } from "../core/findings.js";
import type { KicadCheckFinding } from "../kicad/cli.js";
import { normalizeRelative } from "../util/paths.js";

export function ercFindings(root: string, checks: KicadCheckFinding[], config?: BoardGuardConfig): Finding[] {
  return checks.filter((check) => check.kind === "erc").flatMap((check) => {
    const finding = applyConfiguredFinding(makeFinding({
      ruleId: "BG-ERC-001",
      message: check.message,
      locations: [{ path: normalizeRelative(root, check.path), line: check.line ?? 1, column: check.column ?? 1 }]
    }), config);
    return finding ? [finding] : [];
  });
}
