import { configuredSeverity, type BoardGuardConfig } from "../core/config.js";
import { makeFinding, type Finding } from "../core/findings.js";
import type { KicadCliResult } from "../core/types.js";

export function kicadAvailabilityFindings(kicad: KicadCliResult, requireKicad: boolean, config?: BoardGuardConfig): Finding[] {
  if (config?.kicad?.enabled === false) {
    return [];
  }
  if (kicad.found) {
    return [];
  }
  const configured = configuredSeverity(config, "BG-KICAD-001");
  if (configured === "off") {
    return [];
  }
  return [makeFinding({
    ruleId: "BG-KICAD-001",
    severity: requireKicad ? "critical" : (configured ?? "medium"),
    message: requireKicad
      ? "kicad-cli was required but could not be found."
      : "kicad-cli was not found, so KiCad-backed ERC and DRC checks were skipped.",
    locations: [{ path: "." }]
  })];
}
