export const severityOrder = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0
} as const;

export type SeverityName = keyof typeof severityOrder;

export function isSeverityName(value: string): value is SeverityName {
  return Object.hasOwn(severityOrder, value);
}

export function isBlockingSeverity(severity: SeverityName): boolean {
  return severity === "critical" || severity === "high";
}

export function maxSeverity(a: SeverityName, b: SeverityName): SeverityName {
  return severityOrder[a] >= severityOrder[b] ? a : b;
}
