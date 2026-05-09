import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const root = process.cwd();
const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "boardguard-cli-smoke-"));

try {
  const help = execFileSync(process.execPath, ["dist/cli/main.js", "--help"], { cwd: root, encoding: "utf8" });
  if (!help.includes("BoardGuard")) {
    throw new Error("CLI help output did not include BoardGuard");
  }
  const version = execFileSync(process.execPath, ["dist/cli/main.js", "version"], { cwd: root, encoding: "utf8" }).trim();
  if (version !== packageJson.version) {
    throw new Error(`CLI version ${version} did not match package.json ${packageJson.version}`);
  }

  execPnpm(["pack", "--pack-destination", temp], { cwd: root, stdio: "pipe" });
  const tarballs = (await fs.readdir(temp)).filter((file) => file.endsWith(".tgz"));
  if (tarballs.length !== 1) {
    throw new Error("Expected exactly one package tarball");
  }
  await fs.writeFile(path.join(temp, "package.json"), "{\"private\":true}\n", "utf8");
  execPnpm(["add", "--prefer-offline", "--ignore-scripts", "--lockfile=false", path.join(temp, tarballs[0])], {
    cwd: temp,
    stdio: "pipe"
  });
  const installedVersion = execPnpm(["exec", "boardguard", "version"], { cwd: temp, encoding: "utf8" }).trim();
  if (installedVersion !== packageJson.version) {
    throw new Error(`Installed CLI version ${installedVersion} did not match package.json ${packageJson.version}`);
  }
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}

function execPnpm(args, options) {
  if (process.platform !== "win32") {
    return execFileSync("pnpm", args, options);
  }
  const result = spawnSync("cmd.exe", ["/d", "/c", "pnpm", ...args], {
    cwd: options.cwd,
    encoding: options.encoding,
    stdio: options.stdio
  });
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(" ")} failed\n${result.stdout ?? ""}${result.stderr ?? ""}`);
  }
  return result.stdout ?? "";
}
