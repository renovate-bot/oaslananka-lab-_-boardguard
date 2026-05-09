export const referenceFields = ["reference", "references", "refdes", "designator"];
export const valueFields = ["value", "comment"];
export const footprintFields = ["footprint", "package"];
export const manufacturerFields = ["manufacturer", "mfr", "maker"];
export const mpnFields = ["mpn", "manufacturer part number", "mfr part number", "part number"];
export const dnpFields = ["dnp", "do not populate", "donotpopulate", "exclude from bom"];
export const quantityFields = ["qty", "quantity"];

export function pickField(row: Record<string, string>, aliases: string[]): string | undefined {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const found = entries.find(([key]) => key.trim().toLowerCase() === alias);
    if (found && found[1].trim() !== "") {
      return found[1].trim();
    }
  }
  return undefined;
}
