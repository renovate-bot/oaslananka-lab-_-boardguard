import type { BoardGuardReport } from "../core/types.js";
import { formatMarkdown } from "./markdown.js";

export function formatJobSummary(report: BoardGuardReport): string {
  return formatMarkdown(report);
}
