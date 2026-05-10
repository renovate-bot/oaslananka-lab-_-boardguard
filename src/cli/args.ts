import type { AnalyzeOptions, ReportFormat, ScanMode } from "../core/types.js";

export interface ParsedCli {
  command: "scan" | "detect" | "rules" | "version" | "help";
  options: AnalyzeOptions;
  format: ReportFormat;
  outputs: {
    json?: ReportOutputFlag;
    sarif?: ReportOutputFlag;
    markdown?: ReportOutputFlag;
  };
}

export interface ReportOutputFlag {
  requested: boolean;
  path?: string;
}

export function parseArgs(argv: string[], cwd: string): ParsedCli {
  if (argv[0] === "--help" || argv[0] === "-h") {
    return defaultParsed("help", cwd);
  }
  if (argv[0] === "--version" || argv[0] === "-v") {
    return defaultParsed("version", cwd);
  }
  const command = (argv[0] ?? "help") as ParsedCli["command"];
  if (!["scan", "detect", "rules", "version", "help"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }
  const options: AnalyzeOptions = {
    path: cwd,
    mode: "warn",
    requireKicad: false,
    exportPlan: false
  };
  const outputs: ParsedCli["outputs"] = {};
  let format: ReportFormat = "markdown";
  const rest = argv.slice(1);
  let positionalPath: string | undefined;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith("--")) {
      positionalPath = arg;
      continue;
    }
    const rawKey = arg.slice(2);
    const equalsIndex = rawKey.indexOf("=");
    const key = equalsIndex === -1 ? rawKey : rawKey.slice(0, equalsIndex);
    const inlineValue = equalsIndex === -1 ? undefined : rawKey.slice(equalsIndex + 1);
    const readValue = (): string => {
      if (inlineValue !== undefined) {
        if (inlineValue === "") {
          throw new Error(`Missing value for --${key}`);
        }
        return inlineValue;
      }
      const value = rest[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for --${key}`);
      }
      i += 1;
      return value;
    };
    if (key === "path") {
      options.path = readValue();
    } else if (key === "project") {
      options.project = readValue();
    } else if (key === "config") {
      options.config = readValue();
    } else if (key === "format") {
      const value = readValue();
      if (!["json", "sarif", "markdown"].includes(value)) {
        throw new Error("--format must be json, sarif, or markdown");
      }
      format = value as ReportFormat;
    } else if (key === "sarif") {
      const value = readOptionalPath(rest, i, inlineValue, "sarif");
      outputs.sarif = value ? { requested: true, path: value } : { requested: true };
      if (value && inlineValue === undefined) {
        i += 1;
      }
    } else if (key === "json") {
      const value = readOptionalPath(rest, i, inlineValue, "json");
      outputs.json = value ? { requested: true, path: value } : { requested: true };
      if (value && inlineValue === undefined) {
        i += 1;
      }
    } else if (key === "markdown") {
      const value = readOptionalPath(rest, i, inlineValue, "markdown");
      outputs.markdown = value ? { requested: true, path: value } : { requested: true };
      if (value && inlineValue === undefined) {
        i += 1;
      }
    } else if (key === "mode") {
      const value = readValue();
      if (value !== "warn" && value !== "enforce") {
        throw new Error("--mode must be warn or enforce");
      }
      options.mode = value as ScanMode;
    } else if (key === "require-kicad") {
      options.requireKicad = parseBoolean(readValue(), "--require-kicad");
    } else if (key === "kicad-cli") {
      options.kicadCli = readValue();
    } else if (key === "bom") {
      options.bom = readValue();
    } else if (key === "pinmap") {
      options.pinmap = readValue();
    } else if (key === "export-plan") {
      options.exportPlan = true;
    } else {
      throw new Error(`Unknown option: --${key}`);
    }
  }
  if (positionalPath) {
    options.path = positionalPath;
  }
  return { command, options, format, outputs };
}

function defaultParsed(command: ParsedCli["command"], cwd: string): ParsedCli {
  return {
    command,
    options: {
      path: cwd,
      mode: "warn",
      requireKicad: false,
      exportPlan: false
    },
    format: "markdown",
    outputs: {}
  };
}

function readOptionalPath(args: string[], index: number, inlineValue: string | undefined, format: ReportFormat): string | undefined {
  if (inlineValue !== undefined) {
    if (inlineValue === "") {
      throw new Error("Report output path cannot be empty");
    }
    return inlineValue;
  }
  const next = args[index + 1];
  return next && !next.startsWith("--") && hasReportExtension(next, format) ? next : undefined;
}

function hasReportExtension(value: string, format: ReportFormat): boolean {
  const lowered = value.toLowerCase();
  if (format === "json") {
    return lowered.endsWith(".json");
  }
  if (format === "sarif") {
    return lowered.endsWith(".sarif") || lowered.endsWith(".sarif.json");
  }
  return lowered.endsWith(".md") || lowered.endsWith(".markdown");
}

function parseBoolean(value: string, name: string): boolean {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`${name} must be true or false`);
}
