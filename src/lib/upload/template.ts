// Commerly — downloadable CSV template generator.
// Produces a human-friendly header row (field LABELS, with "*" marking required
// columns) followed by realistic example rows, so users see the exact format
// instead of a bare list of machine keys. autoMap() normalizes punctuation, so
// the "*"/parenthesis headers still map back to their fields on re-upload.
import type { ImportTarget } from "./importTargets";

const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Header line of labels ("Name*") for a target. */
export function templateHeader(target: ImportTarget): string {
  return target.fields.map((f) => esc(f.label + (f.required ? "*" : ""))).join(",");
}

/** Full template CSV: header + example rows (or a single blank row if none). */
export function templateCsv(target: ImportTarget): string {
  const header = templateHeader(target);
  const rows =
    target.examples.length > 0
      ? target.examples.map((ex) => target.fields.map((f) => esc(ex[f.key] ?? "")).join(","))
      : [target.fields.map(() => "").join(",")];
  return [header, ...rows].join("\n") + "\n";
}
