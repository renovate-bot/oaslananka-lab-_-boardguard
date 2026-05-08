import { readTextFile } from "../util/fs.js";

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

export async function validateProjectFile(file: string): Promise<ValidationResult> {
  try {
    const text = await readTextFile(file);
    if (text.trim().length < 16) {
      return { ok: false, reason: "file is suspiciously small" };
    }
    JSON.parse(text);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "file could not be read" };
  }
}
