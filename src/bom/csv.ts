export interface CsvTable {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(input: string): CsvTable {
  const records = parseRecords(input);
  if (records.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = records[0].map((header) => header.trim());
  const rows = records.slice(1).filter((row) => row.some((cell) => cell.trim() !== "")).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index]?.trim() ?? "";
    });
    return record;
  });
  return { headers, rows };
}

function parseRecords(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === "\"") {
      if (inQuotes && input[i + 1] === "\"") {
        cell += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && input[i + 1] === "\n") {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}
