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

  const firstProject = projects[0];
  if (!firstProject) {
    return { cli, findings };
  }

  if (firstProject.schematicFiles[0]) {
    const result = await runKicadReport(detected.path, ["sch", "erc"], firstProject.schematicFiles[0], "erc");
    cli.ercStatus = result.status;
    if (result.message) {
      findings.push({ kind: "erc", message: result.message, path: firstProject.schematicFiles[0] });
    }
  }
  if (firstProject.boardFiles[0]) {
    const result = await runKicadReport(detected.path, ["pcb", "drc"], firstProject.boardFiles[0], "drc");
    cli.drcStatus = result.status;
    if (result.message) {
      findings.push({ kind: "drc", message: result.message, path: firstProject.boardFiles[0] });
    }
  }
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
): Promise<{ status: CheckStatus; message?: string }> {
  const output = path.join(os.tmpdir(), `boardguard-${kind}-${process.pid}-${Date.now()}.json`);
  const args = [...command, "--format", "json", "--output", output, "--exit-code-violations", inputFile];
  const result = await runProcess(cliPath, args, 120_000);
  let reportText = "";
  try {
    reportText = await fs.readFile(output, "utf8");
  } catch {
    reportText = "";
  } finally {
    await fs.rm(output, { force: true }).catch(() => undefined);
  }
  const outputText = redactControlCharacters(`${result.stdout}\n${result.stderr}\n${reportText}`.trim());
  if (result.code === 0) {
    return { status: "passed" };
  }
  if (result.timedOut) {
    return { status: "failed", message: `KiCad ${kind.toUpperCase()} timed out` };
  }
  return { status: "failed", message: outputText || `KiCad ${kind.toUpperCase()} exited with code ${result.code ?? "unknown"}` };
}
