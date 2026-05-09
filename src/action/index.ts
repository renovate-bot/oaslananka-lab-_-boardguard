import fs from "node:fs/promises";
import { appendFileSync } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { DefaultArtifactClient } from "@actions/artifact";
import { getOctokit } from "@actions/github";
import { actionInput, booleanActionInput, ensureWorkspaceDirectory, modeActionInput, optionalWorkspacePath, resolveWorkspacePath, workspaceRoot } from "./inputs.js";
import { analyze, shouldFail } from "../core/analyzer.js";
import type { AnalyzeOptions } from "../core/types.js";
import { formatJson } from "../report/json.js";
import { formatJobSummary } from "../report/summary.js";
import { formatSarif } from "../report/sarif.js";

async function main(): Promise<void> {
  const workspace = await workspaceRoot();
  const resultsDir = await ensureWorkspaceDirectory(workspace, "boardguard-results", "results");
  const options: AnalyzeOptions = {
    path: await resolveWorkspacePath(workspace, actionInput("path"), "path", true),
    project: await optionalWorkspacePath(workspace, actionInput("project"), "project", true),
    config: await optionalWorkspacePath(workspace, actionInput("config"), "config", false),
    mode: modeActionInput(),
    requireKicad: booleanActionInput("require-kicad"),
    kicadCli: emptyToUndefined(actionInput("kicad-cli")),
    bom: await optionalWorkspacePath(workspace, actionInput("bom"), "bom", true),
    pinmap: await optionalWorkspacePath(workspace, actionInput("pinmap"), "pinmap", true),
    exportPlan: true
  };

  const report = await analyze(options);
  const jsonPath = path.join(resultsDir, "boardguard.json");
  const sarifPath = path.join(resultsDir, "boardguard.sarif");
  const markdownPath = path.join(resultsDir, "boardguard.md");
  const writtenFiles: string[] = [];

  if (booleanActionInput("json")) {
    await fs.writeFile(jsonPath, formatJson(report), "utf8");
    writtenFiles.push(jsonPath);
  }
  if (booleanActionInput("sarif")) {
    await fs.writeFile(sarifPath, formatSarif(report), "utf8");
    writtenFiles.push(sarifPath);
  }
  if (booleanActionInput("markdown")) {
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
  setOutput("sarif-path", booleanActionInput("sarif") ? relative(workspace, sarifPath) : "");
  setOutput("json-path", booleanActionInput("json") ? relative(workspace, jsonPath) : "");
  setOutput("markdown-path", booleanActionInput("markdown") ? relative(workspace, markdownPath) : "");
  setOutput("project-count", String(report.projectCount));
  setOutput("kicad-cli-found", String(report.kicad.found));
  setOutput("erc-status", report.kicad.ercStatus);
  setOutput("drc-status", report.kicad.drcStatus);

  if (isGitHubActions() && booleanActionInput("upload-artifacts") && writtenFiles.length > 0) {
    const artifact = new DefaultArtifactClient();
    await artifact.uploadArtifact("boardguard-results", writtenFiles, resultsDir, { retentionDays: 14 });
  }

  if (booleanActionInput("upload-sarif") && booleanActionInput("sarif")) {
    await uploadSarif(workspace, sarifPath);
  }

  if (shouldFail(report, options.requireKicad)) {
    throw new Error("BoardGuard failed because the configured policy was not satisfied.");
  }
}

function emptyToUndefined(value: string): string | undefined {
  return value.trim() === "" ? undefined : value;
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

function isGitHubActions(): boolean {
  return process.env.GITHUB_ACTIONS === "true";
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
