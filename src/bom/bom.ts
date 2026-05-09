import { readTextFile } from "../util/fs.js";
import type { ComponentRecord } from "../core/types.js";
import { parseCsv } from "./csv.js";
import { dnpFields, footprintFields, manufacturerFields, mpnFields, pickField, quantityFields, referenceFields, valueFields } from "./fields.js";

export async function parseBomCsv(file: string): Promise<ComponentRecord[]> {
  const text = await readTextFile(file);
  const table = parseCsv(text);
  const components: ComponentRecord[] = [];
  table.rows.forEach((row, index) => {
    const reference = pickField(row, referenceFields);
    if (!reference) {
      return;
    }
    const designators = splitDesignators(reference);
    const quantity = parseQuantity(pickField(row, quantityFields));
    for (const designator of designators) {
      components.push({
        reference: designator,
        value: pickField(row, valueFields),
        footprint: pickField(row, footprintFields),
        manufacturer: pickField(row, manufacturerFields),
        mpn: pickField(row, mpnFields),
        sourcePath: file,
        source: "bom",
        line: index + 2,
        dnp: isTruthy(pickField(row, dnpFields)),
        rawFields: row,
        rowQuantity: quantity,
        rowReferences: designators
      });
    }
  });
  return components.sort((a, b) => a.reference.localeCompare(b.reference));
}

function parseQuantity(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function isTruthy(value: string | undefined): boolean {
  return value !== undefined && /^(1|true|yes|y|dnp)$/i.test(value.trim());
}

function splitDesignators(value: string): string[] {
  return value
    .split(/[;\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
