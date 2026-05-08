import { spawn } from "node:child_process";

export interface ProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export function runProcess(file: string, args: string[], timeoutMs: number): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const child = spawn(file, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGTERM");
      resolve({ code: null, stdout, stderr, timedOut: true });
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: `${stderr}${error.message}`, timedOut: false });
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut: false });
    });
  });
}
