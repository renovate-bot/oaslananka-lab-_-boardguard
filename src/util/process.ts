import { spawn } from "node:child_process";

export interface ProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: string;
}

export interface ProcessOptions {
  timeoutMs: number;
  maxStdoutBytes?: number;
  maxStderrBytes?: number;
  killGraceMs?: number;
}

const defaultMaxOutputBytes = 64 * 1024;

export function runProcess(file: string, args: string[], timeoutOrOptions: number | ProcessOptions): Promise<ProcessResult> {
  const options = typeof timeoutOrOptions === "number" ? { timeoutMs: timeoutOrOptions } : timeoutOrOptions;
  const maxStdoutBytes = options.maxStdoutBytes ?? defaultMaxOutputBytes;
  const maxStderrBytes = options.maxStderrBytes ?? defaultMaxOutputBytes;
  const killGraceMs = options.killGraceMs ?? 2_000;

  return new Promise((resolve) => {
    const child = spawn(file, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let settled = false;
    let timedOut = false;
    let killTimer: NodeJS.Timeout | undefined;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      killTimer = setTimeout(() => {
        if (!settled) {
          child.kill("SIGKILL");
        }
      }, killGraceMs);
    }, options.timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      const capped = appendCapped(stdout, stdoutBytes, chunk, maxStdoutBytes);
      stdout = capped.value;
      stdoutBytes = capped.bytes;
      stdoutTruncated ||= capped.truncated;
    });
    child.stderr.on("data", (chunk: string) => {
      const capped = appendCapped(stderr, stderrBytes, chunk, maxStderrBytes);
      stderr = capped.value;
      stderrBytes = capped.bytes;
      stderrTruncated ||= capped.truncated;
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (killTimer) {
        clearTimeout(killTimer);
      }
      resolve({
        code: null,
        stdout: finalizeOutput(stdout, stdoutTruncated),
        stderr: finalizeOutput(stderr, stderrTruncated),
        timedOut,
        error: error.message
      });
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (killTimer) {
        clearTimeout(killTimer);
      }
      resolve({
        code: timedOut ? null : code,
        stdout: finalizeOutput(stdout, stdoutTruncated),
        stderr: finalizeOutput(stderr, stderrTruncated),
        timedOut
      });
    });
  });
}

function appendCapped(current: string, currentBytes: number, chunk: string, maxBytes: number): { value: string; bytes: number; truncated: boolean } {
  if (currentBytes >= maxBytes) {
    return { value: current, bytes: currentBytes, truncated: true };
  }
  const chunkBytes = Buffer.byteLength(chunk, "utf8");
  if (currentBytes + chunkBytes <= maxBytes) {
    return { value: `${current}${chunk}`, bytes: currentBytes + chunkBytes, truncated: false };
  }
  const remaining = maxBytes - currentBytes;
  let clipped = "";
  let bytes = 0;
  for (const char of chunk) {
    const charBytes = Buffer.byteLength(char, "utf8");
    if (bytes + charBytes > remaining) {
      break;
    }
    clipped += char;
    bytes += charBytes;
  }
  return { value: `${current}${clipped}`, bytes: maxBytes, truncated: true };
}

function finalizeOutput(value: string, truncated: boolean): string {
  return truncated ? `${value}\n[boardguard: output truncated]\n` : value;
}
