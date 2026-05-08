import YAML from "yaml";
import { readTextFile } from "../util/fs.js";
import { validatePinmapDocument, type PinmapValidation } from "./schema.js";

export async function loadPinmap(file: string): Promise<PinmapValidation> {
  try {
    const text = await readTextFile(file);
    const parsed = file.endsWith(".json") ? JSON.parse(text) : YAML.parse(text);
    return validatePinmapDocument(parsed);
  } catch (error) {
    return {
      entries: [],
      errors: [error instanceof Error ? error.message : "pinmap could not be parsed"]
    };
  }
}
