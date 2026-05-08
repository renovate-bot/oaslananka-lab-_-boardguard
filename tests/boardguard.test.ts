import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyze, shouldFail } from "../src/core/analyzer.js";
import { discoverProjects } from "../src/core/discovery.js";
import { validateConfig } from "../src/core/config.js";
import { parseBomCsv } from "../src/bom/bom.js";
import { validatePinmapDocument } from "../src/pinmap/schema.js";
import { formatJson } from "../src/report/json.js";
import { formatMarkdown } from "../src/report/markdown.js";
import { formatSarif } from "../src/report/sarif.js";
import { runCli } from "../src/cli/main.js";

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
});

describe("reports and CLI behavior", () => {
  it("produces stable JSON, Markdown, and SARIF", async () => {
    const report = await scanFixture("safe-basic");
    expect(JSON.parse(formatJson(report)).schemaVersion).toBe(1);
    expect(formatMarkdown(report)).toContain("BoardGuard Report");
    expect(JSON.parse(formatSarif(report)).version).toBe("2.1.0");
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
