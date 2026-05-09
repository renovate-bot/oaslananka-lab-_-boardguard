import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathExists } from "../util/fs.js";
import { runProcess } from "../util/process.js";
import { redactControlCharacters } from "../util/redaction.js";
import type { CheckStatus, KicadCliResult, ProjectDiscovery } from "../core/types.js";

export interface KicadCheckFinding {
  kind: "erc" | "drc";
  message: string;
  path: string;
  line?: number;
  column?: number;
  severity?: string;
  metadata?: Record<string, unknown>;
}

export interface KicadRunResult {
  cli: KicadCliResult;
  findings: KicadCheckFinding[];
}

export async function runKicadChecks(projects: ProjectDiscovery[], cliPathInput?: string): Promise<KicadRunResult> {
  const detected = await detectKicadCli(cliPathInput);
  const cli: KicadCliResult = {
    found: detected.found,
    path: detected.path,
    version: detected.version,
    ercStatus: detected.found ? "skipped" : "unavailable",
    drcStatus: detected.found ? "skipped" : "unavailable"
  };
  const findings: KicadCheckFinding[] = [];
  if (!detected.found || !detected.path) {
    return { cli, findings };
  }

  let ercRan = false;
  let drcRan = false;
  let ercFailed = false;
  let drcFailed = false;
  for (const project of projects) {
    for (const schematic of project.schematicFiles) {
      ercRan = true;
      const result = await runKicadReport(detected.path, ["sch", "erc"], schematic, "erc");
      ercFailed ||= result.status === "failed";
      findings.push(...result.findings);
    }
    for (const board of project.boardFiles) {
      drcRan = true;
      const result = await runKicadReport(detected.path, ["pcb", "drc"], board, "drc");
      drcFailed ||= result.status === "failed";
      findings.push(...result.findings);
    }
  }
  cli.ercStatus = ercRan ? (ercFailed ? "failed" : "passed") : "skipped";
  cli.drcStatus = drcRan ? (drcFailed ? "failed" : "passed") : "skipped";
  return { cli, findings };
}

async function detectKicadCli(cliPathInput?: string): Promise<{ found: boolean; path?: string; version?: string }> {
  const candidates = cliPathInput ? [cliPathInput] : ["kicad-cli"];
  for (const candidate of candidates) {
    if (cliPathInput && !(await pathExists(candidate))) {
      continue;
    }
    const version = await runProcess(candidate, ["version"], 10_000);
    if (version.code === 0) {
      return {
        found: true,
        path: candidate,
        version: redactControlCharacters(version.stdout.trim() || version.stderr.trim())
      };
    }
    const dashed = await runProcess(candidate, ["--version"], 10_000);
    if (dashed.code === 0) {
      return {
        found: true,
        path: candidate,
        version: redactControlCharacters(dashed.stdout.trim() || dashed.stderr.trim())
      };
    }
  }
  return { found: false };
}

async function runKicadReport(
  cliPath: string,
  command: string[],
  inputFile: string,
  kind: "erc" | "drc"
): Promise<{ status: CheckStatus; findings: KicadCheckFinding[] }> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "boardguard-"));
  const output = path.join(tempDir, `${kind}.json`);
  const args = [...command, "--format", "json", "--output", output, "--exit-code-violations", inputFile];
  const result = await runProcess(cliPath, args, { timeoutMs: 120_000, maxStdoutBytes: 128 * 1024, maxStderrBytes: 128 * 1024 });
  let reportText = "";
  try {
    reportText = await fs.readFile(output, "utf8");
  } catch {
    reportText = "";
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
  const outputText = redactControlCharacters(`${result.stdout}\n${result.stderr}\n${reportText}`.trim());
  if (result.code === 0) {
    return { status: "passed", findings: normalizeKicadFindings(kind, inputFile, reportText) };
  }
  if (result.timedOut) {
    return { status: "failed", findings: [{ kind, message: `KiCad ${kind.toUpperCase()} timed out`, path: inputFile }] };
  }
  const parsed = normalizeKicadFindings(kind, inputFile, reportText);
  if (parsed.length > 0) {
    return { status: "failed", findings: parsed };
  }
  return {
    status: "failed",
    findings: [{ kind, message: outputText || `KiCad ${kind.toUpperCase()} exited with code ${result.code ?? "unknown"}`, path: inputFile }]
  };
}

export function normalizeKicadFindings(kind: "erc" | "drc", fallbackPath: string, reportText: string): KicadCheckFinding[] {
  if (!reportText.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(reportText) as unknown;
    const findings: KicadCheckFinding[] = [];
    collectDiagnostics(parsed, kind, fallbackPath, findings);
    return findings.sort((a, b) => a.path.localeCompare(b.path) || (a.line ?? 0) - (b.line ?? 0) || a.message.localeCompare(b.message));
  } catch {
    return [{ kind, message: redactControlCharacters(reportText), path: fallbackPath }];
  }
}

const maxDiagnosticDepth = 16;
const maxDiagnosticFindings = 1_000;

function collectDiagnostics(value: unknown, kind: "erc" | "drc", fallbackPath: string, findings: KicadCheckFinding[], depth = 0): void {
  if (depth > maxDiagnosticDepth || findings.length >= maxDiagnosticFindings) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectDiagnostics(entry, kind, fallbackPath, findings, depth + 1));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  const row = value as Record<string, unknown>;
  const message = stringField(row, ["message", "description", "title", "text"]);
  if (message) {
    findings.push({
      kind,
      message: redactControlCharacters(message),
      path: stringField(row, ["file", "path", "filename", "source"]) ?? fallbackPath,
      line: numberField(row, ["line", "startLine"]),
      column: numberField(row, ["column", "startColumn"]),
      severity: stringField(row, ["severity", "level", "kind"]),
      metadata: row
    });
    return;
  }
  for (const entry of Object.values(row)) {
    collectDiagnostics(entry, kind, fallbackPath, findings, depth + 1);
  }
}

function stringField(row: Record<string, unknown>, names: string[]): string | undefined {
  for (const name of names) {
    const value = row[name];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return undefined;
}

function numberField(row: Record<string, unknown>, names: string[]): number | undefined {
  for (const name of names) {
    const value = row[name];
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
      return value;
    }
  }
  return undefined;
}
