import type { BoardGuardReport } from "../core/types.js";
import { ruleDefinitions } from "../core/findings.js";
import { createHash } from "node:crypto";

export function formatSarif(report: BoardGuardReport): string {
  const sarif = {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "BoardGuard",
            informationUri: "https://github.com/oaslananka-lab/boardguard",
            semanticVersion: report.tool.version,
            rules: Object.values(ruleDefinitions).map((rule) => ({
              id: rule.id,
              name: rule.title,
              shortDescription: { text: rule.title },
              fullDescription: { text: `${rule.title}. Maturity: ${rule.maturity}.` },
              helpUri: `https://github.com/oaslananka-lab/boardguard/blob/main/docs/rules.md#${rule.id.toLowerCase()}`,
              help: { text: rule.remediation },
              properties: {
                defaultSeverity: rule.defaultSeverity,
                maturity: rule.maturity
              }
            }))
          }
        },
        results: report.findings.map((finding) => ({
          ruleId: finding.ruleId,
          level: sarifLevel(finding.severity),
          message: { text: finding.message },
          partialFingerprints: {
            primaryLocationLineHash: fingerprint(finding.ruleId, finding.message, finding.locations.map((location) => `${location.path}:${location.line ?? 1}:${location.column ?? 1}`).join("|"))
          },
          locations: finding.locations.length > 0 ? finding.locations.map((location) => ({
            physicalLocation: {
              artifactLocation: { uri: normalizeUri(location.path) },
              region: {
                startLine: location.line ?? 1,
                startColumn: location.column ?? 1
              }
            }
          })) : [{ physicalLocation: { artifactLocation: { uri: "." }, region: { startLine: 1, startColumn: 1 } } }]
        }))
      }
    ]
  };
  return `${JSON.stringify(sarif, null, 2)}\n`;
}

function fingerprint(...parts: string[]): string {
  return createHash("sha256").update(parts.join("\0")).digest("hex");
}

function normalizeUri(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function sarifLevel(severity: string): "error" | "warning" | "note" {
  if (severity === "critical" || severity === "high") {
    return "error";
  }
  if (severity === "medium") {
    return "warning";
  }
  return "note";
}
