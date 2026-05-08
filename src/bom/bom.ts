import { readTextFile } from "../util/fs.js";
import type { ComponentRecord } from "../core/types.js";
import { parseCsv } from "./csv.js";
import { footprintFields, manufacturerFields, mpnFields, pickField, referenceFields, valueFields } from "./fields.js";

export async function parseBomCsv(file: string): Promise<ComponentRecord[]> {
  const text = await readTextFile(file);
  const table = parseCsv(text);
  const components: ComponentRecord[] = [];
  table.rows.forEach((row, index) => {
    const reference = pickField(row, referenceFields);
    if (!reference) {
      return;
    }
    for (const designator of splitDesignators(reference)) {
      components.push({
        reference: designator,
        value: pickField(row, valueFields),
        footprint: pickField(row, footprintFields),
        manufacturer: pickField(row, manufacturerFields),
        mpn: pickField(row, mpnFields),
        sourcePath: file,
        line: index + 2
      });
    }
  });
  return components.sort((a, b) => a.reference.localeCompare(b.reference));
}

function splitDesignators(value: string): string[] {
  return value
    .split(/[;\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
