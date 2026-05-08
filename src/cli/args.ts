import type { AnalyzeOptions, ReportFormat, ScanMode } from "../core/types.js";

export interface ParsedCli {
  command: "scan" | "detect" | "rules" | "version" | "help";
  options: AnalyzeOptions;
  format: ReportFormat;
  outputs: {
    json?: string;
    sarif?: string;
    markdown?: string;
  };
}

export function parseArgs(argv: string[], cwd: string): ParsedCli {
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
    const key = arg.slice(2);
    const readValue = (): string => {
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
      outputs.sarif = readOptionalPath(rest, i);
      if (outputs.sarif) {
        i += 1;
      }
    } else if (key === "json") {
      outputs.json = readOptionalPath(rest, i);
      if (outputs.json) {
        i += 1;
      }
    } else if (key === "markdown") {
      outputs.markdown = readOptionalPath(rest, i);
      if (outputs.markdown) {
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

function readOptionalPath(args: string[], index: number): string | undefined {
  const next = args[index + 1];
  return next && !next.startsWith("--") ? next : undefined;
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
