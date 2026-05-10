#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeWithLoadedConfig, boardGuardVersion, canonicalScanRoot, shouldFail } from "../core/analyzer.js";
import { loadConfig } from "../core/config.js";
import { ruleDefinitions } from "../core/findings.js";
import type { ReportFormat } from "../core/types.js";
import { formatJson } from "../report/json.js";
import { formatMarkdown } from "../report/markdown.js";
import { formatSarif } from "../report/sarif.js";
import { writeTextFile } from "../util/fs.js";
import { parseArgs, type ParsedCli } from "./args.js";

export async function runCli(argv: string[], cwd: string, streams = { stdout: process.stdout, stderr: process.stderr }): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs(argv, cwd);
  } catch (error) {
    streams.stderr.write(`${error instanceof Error ? error.message : "Invalid arguments"}\n`);
    streams.stderr.write(helpText());
    return 2;
  }

  if (parsed.command === "help") {
    streams.stdout.write(helpText());
    return 0;
  }
  if (parsed.command === "version") {
    streams.stdout.write(`${boardGuardVersion}\n`);
    return 0;
  }
  if (parsed.command === "rules") {
    streams.stdout.write(`${JSON.stringify(Object.values(ruleDefinitions), null, 2)}\n`);
    return 0;
  }

  const scanOptions = parsed.command === "detect" ? { ...parsed.options, mode: "warn" as const, requireKicad: false } : parsed.options;
  const scanRoot = await canonicalScanRoot(scanOptions.path);
  const loadedConfig = await loadConfig(scanRoot, scanOptions.config);
  const report = await analyzeWithLoadedConfig(scanOptions, loadedConfig, scanRoot);
  const outputTargets = reportOutputTargets(parsed, loadedConfig.config, scanRoot);
  if (outputTargets.json) {
    await writeTextFile(outputTargets.json, formatJson(report));
  }
  if (outputTargets.sarif) {
    await writeTextFile(outputTargets.sarif, formatSarif(report));
  }
  if (outputTargets.markdown) {
    await writeTextFile(outputTargets.markdown, formatMarkdown(report));
  }

  if (parsed.command === "detect") {
    streams.stdout.write(formatJson(report));
    return 0;
  }

  if (parsed.format === "json") {
    streams.stdout.write(formatJson(report));
  } else if (parsed.format === "sarif") {
    streams.stdout.write(formatSarif(report));
  } else {
    streams.stdout.write(formatMarkdown(report));
  }
  return shouldFail(report, parsed.options.requireKicad) ? 1 : 0;
}

function reportOutputTargets(parsed: ParsedCli, config: Awaited<ReturnType<typeof loadConfig>>["config"], scanRoot: string): Partial<Record<ReportFormat, string>> {
  const targets: Partial<Record<ReportFormat, string>> = {};
  for (const format of ["json", "sarif", "markdown"] as const) {
    const cliFlag = parsed.outputs[format];
    if (cliFlag?.requested) {
      targets[format] = path.resolve(scanRoot, cliFlag.path ?? defaultReportFile(format));
      continue;
    }
    if (config?.reports?.[format] === true) {
      targets[format] = path.resolve(scanRoot, defaultReportFile(format));
    }
  }
  return targets;
}

function defaultReportFile(format: ReportFormat): string {
  return format === "sarif" ? "boardguard.sarif" : `boardguard.${format === "markdown" ? "md" : "json"}`;
}

function helpText(): string {
  return `BoardGuard ${boardGuardVersion}

Usage:
  boardguard scan [path] [options]
  boardguard detect
  boardguard rules
  boardguard version
  boardguard help

Options:
  --path <path>              Scan path. Defaults to current directory.
  --project <file>           Explicit .kicad_pro file.
  --config <file>            boardguard.yml path.
  --format <format>          markdown, json, or sarif.
  --json [file]              Write JSON report. Defaults to boardguard.json.
  --sarif [file]             Write SARIF report. Defaults to boardguard.sarif.
  --markdown [file]          Write Markdown report. Defaults to boardguard.md.
  --mode <mode>              warn or enforce.
  --require-kicad <bool>     Require kicad-cli.
  --kicad-cli <path>         Explicit kicad-cli path.
  --bom <file>               Optional BOM CSV.
  --pinmap <file>            Optional firmware pinmap YAML or JSON.
  --export-plan              Include manufacturing dry-run export plan.
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runCli(process.argv.slice(2), process.cwd()).then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "BoardGuard failed"}\n`);
    process.exitCode = 1;
  });
}
