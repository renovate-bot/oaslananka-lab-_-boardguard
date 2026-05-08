import type { BoardGuardReport } from "../core/types.js";

export function formatJson(report: BoardGuardReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
