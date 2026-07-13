import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth/AuthProvider";
import { Can } from "../components/guards";
import { Button, Card, Badge } from "../components/ui/primitives";
import { supabase } from "../lib/supabase/client";
import { MASTER_ENTITIES, MasterEntityKey, useMasterList } from "../lib/data/masterData";
import { parseCsv } from "../lib/upload/parseCsv";
import { specFor, autoMap, validateRows, rejectedToCsv } from "../lib/upload/importSpec";

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function UploadCenterPage() {
  const { activeOrgId } = useAuth();
  const qc = useQueryClient();
  const [entity, setEntity] = useState<MasterEntityKey>("channels");
  const [csv, setCsv] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const spec = useMemo(() => specFor(entity), [entity]);
  const existing = useMasterList(entity, activeOrgId);
  const existingKeys = useMemo(
    () => new Set((existing.data ?? []).map((r: any) => String(r[spec.uniqueField] ?? "").trim().toLowerCase())),
    [existing.data, spec.uniqueField],
  );

  const parsed = useMemo(() => (csv.trim() ? parseCsv(csv) : { headers: [], rows: [] }), [csv]);

  // auto-map whenever headers change
  const effectiveMapping = useMemo(() => {
    if (parsed.headers.length === 0) return {};
    const auto = autoMap(spec, parsed.headers);
    return { ...auto, ...mapping };
  }, [parsed.headers, spec, mapping]);

  const result = useMemo(
    () => (parsed.headers.length ? validateRows(spec, parsed.headers, parsed.rows, effectiveMapping, existingKeys) : null),
    [spec, parsed, effectiveMapping, existingKeys],
  );

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setCsv(String(reader.result ?? "")); setMapping({}); };
    reader.readAsText(file);
  }

  function loadTemplate() {
    setCsv(spec.fields.map((f) => f.key).join(",") + "\n");
    setMapping({});
  }

  async function commit() {
    if (!supabase || !activeOrgId || !result || result.accepted.length === 0) return;
    setImporting(true); setImportMsg(null);
    try {
      const payload = result.accepted.map((r) => ({ ...r, organization_id: activeOrgId }));
      const { error } = await supabase.from(entity).insert(payload);
      if (error) throw new Error(error.message);
      setImportMsg(`Imported ${payload.length} ${spec.label.toLowerCase()}.`);
      setCsv("");
      qc.invalidateQueries({ queryKey: ["master", entity, activeOrgId] });
      existing.refetch();
    } catch (e) {
      setImportMsg((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Upload Center</h1>
        <p className="text-sm text-slate-500">Bulk import master data from CSV — auto column mapping, validation preview, duplicate detection, rejected-row export.</p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(MASTER_ENTITIES) as MasterEntityKey[]).map((k) => (
          <button key={k} onClick={() => { setEntity(k); setCsv(""); setMapping({}); setImportMsg(null); }}
            className={`rounded-lg px-3 py-1.5 text-sm ${entity === k ? "bg-brand text-brand-fg" : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
            {MASTER_ENTITIES[k].label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="mb-2 font-semibold">1 · Provide CSV</h3>
          <div className="mb-2 flex gap-2">
            <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">
              Choose file<input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
            </label>
            <Button variant="ghost" onClick={loadTemplate}>Load template</Button>
          </div>
          <textarea
            value={csv} onChange={(e) => { setCsv(e.target.value); setMapping({}); }}
            placeholder={`Paste CSV here, e.g.\n${spec.fields.map((f) => f.key).join(",")}`}
            className="h-48 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs dark:border-slate-600 dark:bg-slate-800"
          />
          <Button variant="ghost" onClick={() => download(`${entity}-template.csv`, spec.fields.map((f) => f.key).join(",") + "\n")}>
            Download template
          </Button>
        </Card>

        <Card>
          <h3 className="mb-2 font-semibold">2 · Map columns</h3>
          {parsed.headers.length === 0 ? (
            <p className="text-sm text-slate-400">Provide CSV to map its columns.</p>
          ) : (
            <div className="space-y-2">
              {spec.fields.map((f) => (
                <label key={f.key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{f.label}{f.required ? " *" : ""}</span>
                  <select
                    value={effectiveMapping[f.key] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800">
                    <option value="">—</option>
                    {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-2 font-semibold">3 · Preview & import</h3>
          {!result ? (
            <p className="text-sm text-slate-400">Preview appears once CSV is provided.</p>
          ) : (
            <div>
              <div className="mb-2 flex gap-2">
                <Badge tone="green">{result.accepted.length} ready</Badge>
                <Badge tone={result.rejected.length ? "red" : "slate"}>{result.rejected.length} rejected</Badge>
                <span className="text-xs text-slate-400">of {result.total}</span>
              </div>
              <Can permission="create">
                <Button onClick={commit} disabled={importing || result.accepted.length === 0} className="w-full">
                  {importing ? "Importing…" : `Import ${result.accepted.length} row(s)`}
                </Button>
              </Can>
              {result.rejected.length > 0 && (
                <Button variant="ghost" className="mt-2 w-full text-red-600"
                  onClick={() => download(`${entity}-rejected.csv`, rejectedToCsv(spec, result.rejected))}>
                  Download rejected rows
                </Button>
              )}
            </div>
          )}
          {importMsg && <p className="mt-2 text-xs font-medium text-emerald-600">{importMsg}</p>}
        </Card>
      </div>

      {result && result.rejected.length > 0 && (
        <Card className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase text-slate-400">Rejected rows</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400 dark:border-slate-700">
                  <th className="py-2 pr-4">Row</th>
                  {spec.fields.map((f) => <th key={f.key} className="py-2 pr-4">{f.label}</th>)}
                  <th className="py-2 pr-4">Errors</th>
                </tr>
              </thead>
              <tbody>
                {result.rejected.slice(0, 50).map((r) => (
                  <tr key={r.rowNumber} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4 text-slate-400">{r.rowNumber}</td>
                    {spec.fields.map((f) => <td key={f.key} className="py-2 pr-4">{r.values[f.key] || "—"}</td>)}
                    <td className="py-2 pr-4 text-red-600">{r.errors.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
