// Commerly — dependency-free CSV parser. Handles quoted fields, escaped quotes
// (""), embedded commas/newlines, and CRLF. Returns headers + string rows.

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function parseCsv(text: string): ParsedCsv {
  const all: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let started = false; // whether the current row has any content

  const pushField = () => { row.push(field); field = ""; started = true; };
  const pushRow = () => { all.push(row); row = []; started = false; };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; started = true; }
    else if (c === ",") pushField();
    else if (c === "\r") { /* ignore, handle on \n */ }
    else if (c === "\n") { pushField(); pushRow(); }
    else { field += c; started = true; }
  }
  // flush trailing field/row
  if (started || field.length > 0) { pushField(); pushRow(); }

  // drop fully-empty rows (e.g., trailing blank line)
  const nonEmpty = all.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map((h) => h.trim());
  return { headers, rows: nonEmpty.slice(1) };
}
