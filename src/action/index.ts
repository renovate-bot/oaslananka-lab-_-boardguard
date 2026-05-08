import fs from "node:fs/promises";
import { appendFileSync } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { DefaultArtifactClient } from "@actions/artifact";
import { getOctokit } from "@actions/github";
import { analyze, shouldFail } from "../core/analyzer.js";
import type { AnalyzeOptions } from "../core/types.js";
import { formatJson } from "../report/json.js";
import { formatJobSummary } from "../report/summary.js";
import { formatSarif } from "../report/sarif.js";

async function main(): Promise<void> {
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const resultsDir = path.join(workspace, "boardguard-results");
  await fs.mkdir(resultsDir, { recursive: true });
  const options: AnalyzeOptions = {
    path: resolveWorkspace(workspace, input("path") || "."),
    project: emptyToUndefined(input("project")),
    config: emptyToUndefined(input("config") || "boardguard.yml"),
    mode: input("mode") === "enforce" ? "enforce" : "warn",
    requireKicad: boolInput("require-kicad"),
    kicadCli: emptyToUndefined(input("kicad-cli")),
    bom: emptyToUndefined(input("bom")),
    pinmap: emptyToUndefined(input("pinmap")),
    exportPlan: true
  };

  const report = await analyze(options);
  const jsonPath = path.join(resultsDir, "boardguard.json");
  const sarifPath = path.join(resultsDir, "boardguard.sarif");
  const markdownPath = path.join(resultsDir, "boardguard.md");
  const writtenFiles: string[] = [];

  if (boolInput("json")) {
    await fs.writeFile(jsonPath, formatJson(report), "utf8");
    writtenFiles.push(jsonPath);
  }
  if (boolInput("sarif")) {
    await fs.writeFile(sarifPath, formatSarif(report), "utf8");
    writtenFiles.push(sarifPath);
  }
  if (boolInput("markdown")) {
    await fs.writeFile(markdownPath, formatJobSummary(report), "utf8");
    writtenFiles.push(markdownPath);
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, formatJobSummary(report), "utf8");
  }

  setOutput("findings", String(report.counts.total));
  setOutput("critical", String(report.counts.critical));
  setOutput("high", String(report.counts.high));
  setOutput("medium", String(report.counts.medium));
  setOutput("low", String(report.counts.low));
  setOutput("sarif-path", boolInput("sarif") ? relative(workspace, sarifPath) : "");
  setOutput("json-path", boolInput("json") ? relative(workspace, jsonPath) : "");
  setOutput("markdown-path", boolInput("markdown") ? relative(workspace, markdownPath) : "");
  setOutput("project-count", String(report.projectCount));
  setOutput("kicad-cli-found", String(report.kicad.found));
  setOutput("erc-status", report.kicad.ercStatus);
  setOutput("drc-status", report.kicad.drcStatus);

  if (boolInput("upload-artifacts") && writtenFiles.length > 0) {
    const artifact = new DefaultArtifactClient();
    await artifact.uploadArtifact("boardguard-results", writtenFiles, resultsDir, { retentionDays: 14 });
  }

  if (boolInput("upload-sarif") && boolInput("sarif")) {
    await uploadSarif(workspace, sarifPath);
  }

  if (shouldFail(report, options.requireKicad)) {
    throw new Error("BoardGuard failed because the configured policy was not satisfied.");
  }
}

function input(name: string): string {
  const keys = [
    `INPUT_${name.toUpperCase()}`,
    `INPUT_${name.replace(/-/g, "_").toUpperCase()}`
  ];
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined) {
      return value.trim();
    }
  }
  return "";
}

function boolInput(name: string): boolean {
  return (input(name) || "false").toLowerCase() === "true";
}

function emptyToUndefined(value: string): string | undefined {
  return value.trim() === "" ? undefined : value;
}

function resolveWorkspace(workspace: string, value: string): string {
  return path.isAbsolute(value) ? value : path.join(workspace, value);
}

function relative(root: string, value: string): string {
  return path.relative(root, value).replace(/\\/g, "/");
}

function setOutput(name: string, value: string): void {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, "utf8");
}

async function uploadSarif(workspace: string, sarifPath: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const ref = process.env.GITHUB_REF;
  const commitSha = process.env.GITHUB_SHA;
  if (!token || !repository || !ref || !commitSha) {
    throw new Error("SARIF upload requires GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_REF, and GITHUB_SHA.");
  }
  const [owner, repo] = repository.split("/");
  const octokit = getOctokit(token);
  const sarif = await fs.readFile(sarifPath);
  const gzipped = zlib.gzipSync(sarif).toString("base64");
  await octokit.request("POST /repos/{owner}/{repo}/code-scanning/sarifs", {
    owner,
    repo,
    commit_sha: commitSha,
    ref,
    sarif: gzipped,
    checkout_uri: workspace
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "BoardGuard action failed"}\n`);
  process.exitCode = 1;
});
