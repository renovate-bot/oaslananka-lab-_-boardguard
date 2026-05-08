import fs from "node:fs/promises";

const inputFile = process.argv[2];
const text = inputFile ? await fs.readFile(inputFile, "utf8") : await readStdin();
const rules = [
  ["workflow syntax/actionlint", /actionlint|workflow syntax|Invalid workflow file/i],
  ["zizmor issue", /zizmor/i],
  ["secret scan finding", /gitleaks|secret detected|private key/i],
  ["CodeQL finding", /codeql|code scanning/i],
  ["dependency audit finding", /pnpm audit|npm audit|osv|vulnerabilit/i],
  ["test failure", /vitest|test failed|AssertionError/i],
  ["typecheck failure", /tsc|typecheck|TS\d{4}/i],
  ["lint failure", /lint|forbidden pattern/i],
  ["package build failure", /esbuild|build failed|tsup/i],
  ["action metadata invalid", /action metadata|action\.yml|runs\.using/i],
  ["SARIF invalid", /sarif/i],
  ["boardguard config invalid", /boardguard\.yml|configuration/i],
  ["KiCad CLI unavailable", /kicad-cli.*unavailable|kicad-cli.*not found/i],
  ["KiCad ERC failed", /erc failed|BG-ERC-001/i],
  ["KiCad DRC failed", /drc failed|BG-DRC-001/i],
  ["fixture mismatch", /fixture.*differs|expected report/i],
  ["release tag/version mismatch", /tag.*version|manifest.*version/i],
  ["release-please config error", /release-please/i],
  ["flaky/infra failure", /ECONNRESET|ETIMEDOUT|rate limit|runner.*lost|Service Unavailable/i]
];
const match = rules.find(([, pattern]) => pattern.test(text));
const classification = match?.[0] ?? "unknown";
process.stdout.write(`${JSON.stringify({ classification, confidence: classification === "unknown" ? "low" : "medium" }, null, 2)}\n`);

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
  });
}
