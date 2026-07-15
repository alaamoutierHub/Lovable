// Commerly — bulk import specs + row validation for master data.
// Maps CSV columns to entity fields, validates each row, detects in-file
// duplicates and rows that collide with existing keys, and separates
// accepted rows from rejected rows (with reasons) for re-export.

import { MASTER_ENTITIES, type MasterEntityKey, type FieldDef } from "../data/masterData";

export interface ImportField extends FieldDef {}

export interface ImportSpec {
  key: MasterEntityKey;
  label: string;
  fields: ImportField[];
  /** field used to detect duplicates (unique per org) */
  uniqueField: string;
}

export function specFor(entity: MasterEntityKey): ImportSpec {
  const def = MASTER_ENTITIES[entity];
  const uniqueField = entity === "products" ? "sku_code" : "name";
  return { key: entity, label: def.label, fields: def.fields, uniqueField };
}

/** Suggest a source-header → field mapping by case/punctuation-insensitive match.
 *  Strips ALL non-alphanumerics so template headers like "SKU code*" or
 *  "Country (ISO-2)" still map to their fields. */
export function autoMap(spec: ImportSpec, headers: string[]): Record<string, string> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const map: Record<string, string> = {};
  for (const f of spec.fields) {
    const target = norm(f.key);
    const targetLabel = norm(f.label);
    const hit = headers.find((h) => { const n = norm(h); return n === target || n === targetLabel; });
    if (hit) map[f.key] = hit;
  }
  return map;
}

export interface RejectedRow { rowNumber: number; values: Record<string, string>; errors: string[]; }
export interface ImportResult {
  accepted: Record<string, unknown>[];
  rejected: RejectedRow[];
  total: number;
}

export function validateRows(
  spec: ImportSpec,
  headers: string[],
  rows: string[][],
  mapping: Record<string, string>, // field.key -> source header
  existingKeys: Set<string> = new Set(),
): ImportResult {
  const idxOf = (header: string) => headers.indexOf(header);
  const accepted: Record<string, unknown>[] = [];
  const rejected: RejectedRow[] = [];
  const seen = new Set<string>(); // in-file duplicates
  const normKey = (v: string) => v.trim().toLowerCase();

  rows.forEach((cols, i) => {
    const values: Record<string, string> = {};
    for (const f of spec.fields) {
      const src = mapping[f.key];
      const idx = src ? idxOf(src) : -1;
      values[f.key] = idx >= 0 ? (cols[idx] ?? "").trim() : "";
    }
    const errors: string[] = [];
    const record: Record<string, unknown> = {};

    for (const f of spec.fields) {
      const raw = values[f.key];
      if (f.required && raw === "") { errors.push(`${f.label} is required`); continue; }
      if (raw === "") continue;
      if (f.type === "number") {
        const num = Number(raw);
        if (!Number.isFinite(num)) errors.push(`${f.label} must be a number (got "${raw}")`);
        else if (num < 0) errors.push(`${f.label} cannot be negative`);
        else record[f.key] = num;
      } else {
        record[f.key] = raw;
      }
    }

    // duplicate detection on the unique field (skipped when there is no unique
    // field, e.g. transaction imports like plans/actuals which allow duplicates).
    const keyVal = spec.uniqueField ? values[spec.uniqueField] : "";
    if (spec.uniqueField && keyVal != null && keyVal !== "") {
      const nk = normKey(keyVal);
      if (seen.has(nk)) errors.push(`Duplicate ${spec.uniqueField} within file`);
      else if (existingKeys.has(nk)) errors.push(`${spec.uniqueField} already exists`);
      seen.add(nk);
    }

    if (errors.length > 0) rejected.push({ rowNumber: i + 2, values, errors }); // +2: header + 1-index
    else accepted.push(record);
  });

  return { accepted, rejected, total: rows.length };
}

/** Serialize rejected rows back to CSV (source fields + an _errors column). */
export function rejectedToCsv(spec: ImportSpec, rejected: RejectedRow[]): string {
  const cols = spec.fields.map((f) => f.key);
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const header = [...cols, "_errors"].join(",");
  const lines = rejected.map((r) =>
    [...cols.map((c) => esc(r.values[c] ?? "")), esc(r.errors.join("; "))].join(","),
  );
  return [header, ...lines].join("\n");
}
