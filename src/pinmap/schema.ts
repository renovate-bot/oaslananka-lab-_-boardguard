import type { PinmapEntry } from "../core/types.js";

export interface PinmapValidation {
  entries: PinmapEntry[];
  errors: string[];
}

export function validatePinmapDocument(input: unknown): PinmapValidation {
  const errors: string[] = [];
  if (!input || typeof input !== "object") {
    return { entries: [], errors: ["pinmap must be an object"] };
  }
  const document = input as { version?: unknown; pins?: unknown };
  if (document.version !== 1) {
    errors.push("pinmap.version must be 1");
  }
  if (!Array.isArray(document.pins)) {
    errors.push("pinmap.pins must be an array");
    return { entries: [], errors };
  }
  const entries: PinmapEntry[] = [];
  document.pins.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      errors.push(`pinmap.pins[${index}] must be an object`);
      return;
    }
    const row = entry as Record<string, unknown>;
    const designator = stringField(row, "designator");
    const pin = stringField(row, "pin");
    const net = stringField(row, "net");
    const firmware = stringField(row, "firmware", false);
    if (!designator) {
      errors.push(`pinmap.pins[${index}].designator is required`);
    }
    if (!pin) {
      errors.push(`pinmap.pins[${index}].pin is required`);
    }
    if (!net) {
      errors.push(`pinmap.pins[${index}].net is required`);
    }
    if (designator && pin && net) {
      entries.push({ designator, pin, net, firmware });
    }
  });
  return { entries, errors };
}

function stringField(row: Record<string, unknown>, key: string, required = true): string | undefined {
  const value = row[key];
  if (value === undefined && !required) {
    return undefined;
  }
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}
