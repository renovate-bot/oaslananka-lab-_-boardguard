import { readTextFile } from "../util/fs.js";
import { parseSExpression } from "./sexpr.js";
import type { ComponentRecord } from "../core/types.js";

export interface ParsedSchematic {
  valid: boolean;
  reason?: string;
  components: ComponentRecord[];
  netLabels: string[];
}

export async function parseSchematic(file: string): Promise<ParsedSchematic> {
  try {
    const text = await readTextFile(file);
    if (text.trim().length < 32 || !text.includes("(kicad_sch")) {
      return { valid: false, reason: "schematic file is suspiciously small or missing kicad_sch root", components: [], netLabels: [] };
    }
    parseSExpression(text);
    return {
      valid: true,
      components: extractComponents(text, file),
      netLabels: extractNetLabels(text).sort()
    };
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : "schematic file could not be parsed",
      components: [],
      netLabels: []
    };
  }
}

function extractComponents(text: string, sourcePath: string): ComponentRecord[] {
  const components: ComponentRecord[] = [];
  let index = 0;
  while (index < text.length) {
    const symbolStart = text.indexOf("(symbol", index);
    if (symbolStart === -1) {
      break;
    }
    const symbolText = balancedSlice(text, symbolStart);
    if (!symbolText) {
      break;
    }
    if (!/\(lib_id\s+/.test(symbolText)) {
      index = symbolStart + symbolText.length;
      continue;
    }
    const properties = new Map<string, string>();
    const propertyPattern = /\(property\s+"([^"]+)"\s+"([^"]*)"/g;
    for (const match of symbolText.matchAll(propertyPattern)) {
      properties.set(match[1].toLowerCase(), match[2]);
    }
    const reference = properties.get("reference");
    if (reference && !reference.startsWith("#")) {
      components.push({
        reference,
        value: properties.get("value"),
        footprint: properties.get("footprint"),
        manufacturer: properties.get("manufacturer") ?? properties.get("mfr"),
        mpn: properties.get("mpn") ?? properties.get("manufacturer part number") ?? properties.get("mfr part number"),
        sourcePath,
        source: "schematic",
        line: lineForIndex(text, symbolStart),
        dnp: isTruthy(properties.get("dnp") ?? properties.get("do not populate") ?? properties.get("exclude from bom"))
      });
    }
    index = symbolStart + symbolText.length;
  }
  return components.sort((a, b) => a.reference.localeCompare(b.reference));
}

function isTruthy(value: string | undefined): boolean {
  return value !== undefined && /^(1|true|yes|y|dnp)$/i.test(value.trim());
}

function extractNetLabels(text: string): string[] {
  const labels = new Set<string>();
  const labelPattern = /\((?:label|global_label|hierarchical_label)\s+"([^"]+)"/g;
  for (const match of text.matchAll(labelPattern)) {
    labels.add(match[1]);
  }
  return [...labels];
}

function balancedSlice(text: string, start: number): string | undefined {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\"" && !isEscaped(text, i)) {
      inString = !inString;
    }
    if (inString) {
      continue;
    }
    if (char === "(") {
      depth += 1;
    }
    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return undefined;
}

function isEscaped(text: string, quoteIndex: number): boolean {
  let backslashes = 0;
  for (let i = quoteIndex - 1; i >= 0 && text[i] === "\\"; i -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function lineForIndex(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}
