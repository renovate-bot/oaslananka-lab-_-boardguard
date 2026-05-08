import { readTextFile } from "../util/fs.js";
import { parseSExpression } from "./sexpr.js";

export interface ParsedPcb {
  valid: boolean;
  reason?: string;
}

export async function parsePcb(file: string): Promise<ParsedPcb> {
  try {
    const text = await readTextFile(file);
    if (text.trim().length < 32 || !text.includes("(kicad_pcb")) {
      return { valid: false, reason: "PCB file is suspiciously small or missing kicad_pcb root" };
    }
    parseSExpression(text);
    return { valid: true };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : "PCB file could not be parsed" };
  }
}
