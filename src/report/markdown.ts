import type { BoardGuardReport } from "../core/types.js";

export function formatMarkdown(report: BoardGuardReport): string {
  const lines: string[] = [];
  lines.push("# BoardGuard Report");
  lines.push("");
  lines.push(`Mode: ${report.mode}`);
  lines.push(`Projects: ${report.projectCount}`);
  lines.push(`Findings: ${report.counts.total} (critical ${report.counts.critical}, high ${report.counts.high}, medium ${report.counts.medium}, low ${report.counts.low})`);
  lines.push(`KiCad CLI: ${report.kicad.found ? "found" : "unavailable"}`);
  lines.push(`ERC: ${report.kicad.ercStatus}`);
  lines.push(`DRC: ${report.kicad.drcStatus}`);
  lines.push("");
  if (report.findings.length === 0) {
    lines.push("No findings.");
    return `${lines.join("\n")}\n`;
  }
  lines.push("| Rule | Severity | Location | Message |");
  lines.push("| --- | --- | --- | --- |");
  for (const finding of report.findings) {
    const location = finding.locations[0];
    const locationText = location ? `${location.path}${location.line ? `:${location.line}` : ""}` : ".";
    lines.push(`| ${finding.ruleId} | ${finding.severity} | ${escapeCell(locationText)} | ${escapeCell(finding.message)} |`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function escapeCell(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " ");
}
