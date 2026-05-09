import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyze, shouldFail } from "../src/core/analyzer.js";
import { discoverProjects } from "../src/core/discovery.js";
import { validateConfig } from "../src/core/config.js";
import { parseBomCsv } from "../src/bom/bom.js";
import { resolveWorkspacePath, booleanActionInput, modeActionInput } from "../src/action/inputs.js";
import { validatePinmapDocument } from "../src/pinmap/schema.js";
import { formatJson } from "../src/report/json.js";
import { formatMarkdown } from "../src/report/markdown.js";
import { formatSarif } from "../src/report/sarif.js";
import { runCli } from "../src/cli/main.js";
import { parseSExpression } from "../src/kicad/sexpr.js";
import { runProcess } from "../src/util/process.js";
import { listFiles } from "../src/util/fs.js";
import { normalizeKicadFindings } from "../src/kicad/cli.js";

const fixtureRoot = path.resolve("tests/fixtures/projects");
const missingKicad = path.resolve("tests/fixtures/missing-tools/kicad-cli-not-installed");

describe("project discovery", () => {
  it("discovers one explicit KiCad project", async () => {
    const result = await discoverProjects(path.join(fixtureRoot, "safe-basic"), "safe-basic.kicad_pro");
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].schematicFiles).toHaveLength(1);
    expect(result.projects[0].boardFiles).toHaveLength(1);
  });

  it("detects multiple projects without explicit selection", async () => {
    const report = await scanFixture("multiple-projects");
    expect(report.findings.some((finding) => finding.ruleId === "BG-PROJ-002")).toBe(true);
  });

  it("detects missing board and schematic files", async () => {
    const missingBoard = await scanFixture("missing-board");
    const missingSchematic = await scanFixture("missing-schematic");
    expect(missingBoard.findings.some((finding) => finding.ruleId === "BG-PROJ-003")).toBe(true);
    expect(missingSchematic.findings.some((finding) => finding.ruleId === "BG-PROJ-003")).toBe(true);
  });

  it("does not crash on malformed KiCad files", async () => {
    const report = await scanFixture("malformed");
    expect(report.findings.some((finding) => finding.ruleId === "BG-PROJ-004")).toBe(true);
  });
});

describe("configuration and metadata", () => {
  it("validates boardguard.yml schema subset", () => {
    expect(validateConfig({ version: 1, rules: { "BG-PROJ-001": "error" } })).toEqual([]);
    expect(validateConfig({ version: 2 })).toContain("version must be 1");
    expect(validateConfig({ version: 1, unexpected: true } as never)).toContain("config.unexpected is not supported");
  });

  it("reports invalid BoardGuard configuration with a dedicated rule", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "boardguard-config-"));
    await fs.writeFile(path.join(temp, "boardguard.yml"), "version: 2\n", "utf8");
    const report = await analyze(baseOptions(temp));
    expect(report.findings.some((finding) => finding.ruleId === "BG-CONFIG-001")).toBe(true);
  });

  it("validates pinmap schema", () => {
    const valid = validatePinmapDocument({ version: 1, pins: [{ designator: "U1", pin: "1", net: "MCU_PA0" }] });
    const invalid = validatePinmapDocument({ version: 1, pins: [{ designator: "U1" }] });
    expect(valid.entries).toHaveLength(1);
    expect(invalid.errors.length).toBeGreaterThan(0);
  });
});

describe("BOM rules", () => {
  it("parses BOM CSV and detects missing MPN metadata", async () => {
    const bom = await parseBomCsv(path.join(fixtureRoot, "bom-missing-mpn", "bom.csv"));
    expect(bom[0].reference).toBe("R1");
    const report = await scanFixture("bom-missing-mpn", { bom: "bom.csv" });
    expect(report.findings.some((finding) => finding.ruleId === "BG-BOM-001")).toBe(true);
  });

  it("detects duplicate designators", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "boardguard-"));
    await fs.writeFile(path.join(temp, "boardguard.yml"), completeConfig("dup"), "utf8");
    await fs.writeFile(path.join(temp, "dup.kicad_pro"), JSON.stringify({ meta: { version: 1 } }), "utf8");
    await fs.writeFile(path.join(temp, "dup.kicad_pcb"), pcb("dup"), "utf8");
    await fs.writeFile(path.join(temp, "dup.kicad_sch"), schematic("R1", "R1"), "utf8");
    const report = await analyze(baseOptions(temp));
    expect(report.findings.some((finding) => finding.ruleId === "BG-BOM-002")).toBe(true);
  });

  it("reconciles schematic and BOM records without cross-source duplicate false positives", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "boardguard-bom-"));
    await fs.writeFile(path.join(temp, "boardguard.yml"), `${completeConfig("bom")}
bom:
  input: bom.csv
  required_fields:
    - Reference
    - Value
    - Footprint
    - Manufacturer
    - MPN
`, "utf8");
    await fs.writeFile(path.join(temp, "bom.kicad_pro"), JSON.stringify({ meta: { version: 1 } }), "utf8");
    await fs.writeFile(path.join(temp, "bom.kicad_pcb"), pcb("bom"), "utf8");
    await fs.writeFile(path.join(temp, "bom.kicad_sch"), schematic("R1", "C1"), "utf8");
    await fs.writeFile(path.join(temp, "bom.csv"), "Reference,Value,Footprint,Manufacturer,MPN,Quantity,DNP\nR1,10k,Resistor_SMD:R_0603,Yageo,RC0603FR-0710KL,1,false\nC2,1uF,Capacitor_SMD:C_0603,Samsung,CL10A105KA8NNNC,2,false\nC1,1uF,Capacitor_SMD:C_0603,,,1,true\n", "utf8");
    const report = await analyze(baseOptions(temp));
    const messages = report.findings.map((finding) => finding.message).join("\n");
    expect(messages).not.toContain("Duplicate");
    expect(messages).toContain("BOM row C2 does not match a parsed schematic component");
    expect(messages).toContain("BOM row for C2 declares quantity 2 but lists 1 designators");
    expect(messages).not.toContain("C1 is missing manufacturer or MPN");
  });

  it("reports a BOM row quantity mismatch once for grouped designators", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "boardguard-bom-"));
    await fs.writeFile(path.join(temp, "boardguard.yml"), `${completeConfig("bom")}
bom:
  input: bom.csv
`, "utf8");
    await fs.writeFile(path.join(temp, "bom.kicad_pro"), JSON.stringify({ meta: { version: 1 } }), "utf8");
    await fs.writeFile(path.join(temp, "bom.kicad_pcb"), pcb("bom"), "utf8");
    await fs.writeFile(path.join(temp, "bom.kicad_sch"), schematic("R1", "R2"), "utf8");
    await fs.writeFile(path.join(temp, "bom.csv"), "Reference,Value,Footprint,Manufacturer,MPN,Quantity\nR1 R2,10k,Resistor_SMD:R_0603,Yageo,RC0603FR-0710KL,3\n", "utf8");
    const report = await analyze(baseOptions(temp));
    const quantityFindings = report.findings.filter((finding) => finding.message.includes("declares quantity 3 but lists 2 designators"));
    expect(quantityFindings).toHaveLength(1);
  });
});

describe("reports and CLI behavior", () => {
  it("produces stable JSON, Markdown, and SARIF", async () => {
    const report = await scanFixture("safe-basic");
    expect(JSON.parse(formatJson(report)).schemaVersion).toBe(1);
    expect(formatMarkdown(report)).toContain("BoardGuard Report");
    const sarif = JSON.parse(formatSarif(report));
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs[0].tool.driver.rules[0].helpUri).toContain("docs/rules.md");
    expect(sarif.runs[0].results[0].partialFingerprints.primaryLocationLineHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses warn and enforce exit codes correctly", async () => {
    const warn = await runCli(["scan", "--path", path.join(fixtureRoot, "missing-board"), "--kicad-cli", missingKicad], process.cwd(), memoryStreams());
    const enforce = await runCli(["scan", "--path", path.join(fixtureRoot, "missing-board"), "--mode", "enforce", "--kicad-cli", missingKicad], process.cwd(), memoryStreams());
    const requireKicad = await runCli(["scan", "--path", path.join(fixtureRoot, "safe-basic"), "--require-kicad", "true", "--kicad-cli", missingKicad], process.cwd(), memoryStreams());
    expect(warn).toBe(0);
    expect(enforce).toBe(1);
    expect(requireKicad).toBe(1);
  });

  it("fails enforce reports with high or critical findings", async () => {
    const report = await analyze({ ...baseOptions(path.join(fixtureRoot, "missing-board")), mode: "enforce" });
    expect(shouldFail(report)).toBe(true);
  });

  it("rejects unterminated S-expression strings", () => {
    expect(() => parseSExpression("(kicad_sch (title \"unterminated))")).toThrow("unterminated quoted string");
  });

  it("supports CLI --help and reports package version", async () => {
    const packageJson = JSON.parse(await fs.readFile("package.json", "utf8")) as { version: string };
    const helpStreams = memoryStreams();
    const versionStreams = captureStreams();
    expect(await runCli(["--help"], process.cwd(), helpStreams)).toBe(0);
    expect(await runCli(["version"], process.cwd(), versionStreams as never)).toBe(0);
    expect(versionStreams.stdoutText()).toBe(`${packageJson.version}\n`);
  });
});

describe("action inputs and process hardening", () => {
  it("rejects invalid action booleans and modes", () => {
    const previousJson = process.env.INPUT_JSON;
    const previousMode = process.env.INPUT_MODE;
    process.env.INPUT_JSON = "";
    process.env.INPUT_MODE = "";
    expect(booleanActionInput("json")).toBe(true);
    expect(modeActionInput()).toBe("warn");
    process.env.INPUT_JSON = "maybe";
    process.env.INPUT_MODE = "strict";
    expect(() => booleanActionInput("json")).toThrow("must be true or false");
    expect(() => modeActionInput()).toThrow("mode must be warn or enforce");
    restoreEnv("INPUT_JSON", previousJson);
    restoreEnv("INPUT_MODE", previousMode);
  });

  it("keeps action paths inside GITHUB_WORKSPACE", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "boardguard-workspace-"));
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "boardguard-outside-"));
    await fs.mkdir(path.join(workspace, "nested"));
    await fs.writeFile(path.join(outside, "secret.txt"), "secret", "utf8");
    await expect(resolveWorkspacePath(workspace, "nested", "path", true)).resolves.toContain("nested");
    await expect(resolveWorkspacePath(workspace, "..", "path")).rejects.toThrow("inside GITHUB_WORKSPACE");
    await expect(resolveWorkspacePath(workspace, path.join(outside, "secret.txt"), "path", true)).rejects.toThrow("inside GITHUB_WORKSPACE");
    if (process.platform !== "win32") {
      await fs.symlink(path.join(outside, "secret.txt"), path.join(workspace, "link.txt"));
      await expect(resolveWorkspacePath(workspace, "link.txt", "path", true)).rejects.toThrow("inside GITHUB_WORKSPACE");
    }
  });

  it("caps process output, reports non-zero, timeout, and missing executable deterministically", async () => {
    const success = await runProcess(process.execPath, ["-e", "process.stdout.write('ok')"], { timeoutMs: 5_000 });
    expect(success).toMatchObject({ code: 0, stdout: "ok", timedOut: false });
    const nonZero = await runProcess(process.execPath, ["-e", "process.exit(7)"], { timeoutMs: 5_000 });
    expect(nonZero.code).toBe(7);
    const large = await runProcess(process.execPath, ["-e", "process.stdout.write('x'.repeat(1000))"], { timeoutMs: 5_000, maxStdoutBytes: 16 });
    expect(large.stdout).toContain("output truncated");
    const timeout = await runProcess(process.execPath, ["-e", "setTimeout(() => {}, 5000)"], { timeoutMs: 50, killGraceMs: 50 });
    expect(timeout.timedOut).toBe(true);
    const missing = await runProcess(path.join(os.tmpdir(), "boardguard-missing-executable"), [], { timeoutMs: 50 });
    expect(missing.error).toBeTruthy();
  });
});

describe("bounded file scanning and KiCad normalization", () => {
  it("uses deterministic bounded file traversal", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "boardguard-files-"));
    await fs.mkdir(path.join(temp, "node_modules"), { recursive: true });
    await fs.writeFile(path.join(temp, "a.kicad_pro"), "{}", "utf8");
    await fs.writeFile(path.join(temp, "node_modules", "ignored.kicad_pro"), "{}", "utf8");
    const files = await listFiles(temp, (file) => file.endsWith(".kicad_pro"), { allowedExtensions: [".kicad_pro"] });
    expect(files.map((file) => path.basename(file))).toEqual(["a.kicad_pro"]);
  });

  it("normalizes KiCad JSON diagnostics into individual findings", () => {
    const findings = normalizeKicadFindings("drc", "board.kicad_pcb", JSON.stringify({
      violations: [
        { message: "clearance", file: "board.kicad_pcb", line: 12, column: 3 },
        { description: "track width", path: "board.kicad_pcb", line: 20 }
      ]
    }));
    expect(findings).toHaveLength(2);
    expect(findings[0].message).toBe("clearance");
    expect(findings[0].line).toBe(12);
  });

  it("bounds KiCad diagnostic traversal and avoids nested duplicate diagnostics", () => {
    const duplicateCandidate = normalizeKicadFindings("erc", "board.kicad_sch", JSON.stringify({
      diagnostics: [
        {
          message: "outer diagnostic",
          nested: { message: "inner duplicate candidate" }
        }
      ]
    }));
    expect(duplicateCandidate).toHaveLength(1);
    expect(duplicateCandidate[0].message).toBe("outer diagnostic");

    let deepDiagnostic: Record<string, unknown> = { message: "too deep" };
    for (let index = 0; index < 18; index += 1) {
      deepDiagnostic = { nested: deepDiagnostic };
    }
    expect(normalizeKicadFindings("erc", "board.kicad_sch", JSON.stringify(deepDiagnostic))).toEqual([]);
  });
});

async function scanFixture(name: string, overrides: Partial<Parameters<typeof analyze>[0]> = {}) {
  return analyze({ ...baseOptions(path.join(fixtureRoot, name)), ...overrides });
}

function baseOptions(scanPath: string) {
  return {
    path: scanPath,
    mode: "warn" as const,
    requireKicad: false,
    kicadCli: missingKicad,
    exportPlan: false
  };
}

function memoryStreams() {
  return {
    stdout: { write() { return true; } },
    stderr: { write() { return true; } }
  } as never;
}

function captureStreams() {
  let stdout = "";
  let stderr = "";
  return {
    stdout: { write(value: string) { stdout += value; return true; } },
    stderr: { write(value: string) { stderr += value; return true; } },
    stdoutText() { return stdout; },
    stderrText() { return stderr; }
  };
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function completeConfig(name: string): string {
  return `version: 1
manufacturing:
  board_name: ${name}
  revision: rev-a
  output_dir: manufacturing
  expected_artifacts:
    gerber: true
    drill: true
    bom: true
    cpl: true
    schematic_pdf: true
    pcb_pdf: true
    step: false
`;
}

function schematic(a: string, b: string): string {
  return `(kicad_sch
  (version 20250114)
  (symbol (lib_id "Device:R") (property "Reference" "${a}") (property "Value" "10k") (property "Footprint" "Resistor_SMD:R_0603") (property "Manufacturer" "Yageo") (property "MPN" "RC0603FR-0710KL"))
  (symbol (lib_id "Device:R") (property "Reference" "${b}") (property "Value" "10k") (property "Footprint" "Resistor_SMD:R_0603") (property "Manufacturer" "Yageo") (property "MPN" "RC0603FR-0710KL"))
  (label "MCU_PA0")
)
`;
}

function pcb(name: string): string {
  return `(kicad_pcb
  (version 20250114)
  (general (thickness 1.6))
  (paper "A4")
  (title_block (title "${name}"))
)
`;
}
