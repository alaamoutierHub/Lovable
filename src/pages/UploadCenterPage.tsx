import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth/AuthProvider";
import { Can } from "../components/guards";
import { Button, Card, Badge, Select } from "../components/ui/primitives";
import { supabase } from "../lib/supabase/client";
import { type MasterEntityKey, useMasterList } from "../lib/data/masterData";
import { parseCsv } from "../lib/upload/parseCsv";
import { autoMap, validateRows, rejectedToCsv, type ImportSpec } from "../lib/upload/importSpec";
import { IMPORT_TARGETS, targetByKey, normName, type Lookups } from "../lib/upload/importTargets";
import { templateCsv } from "../lib/upload/template";

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const nameMap = (rows: any[] | undefined, field: string): Map<string, string> => {
  const m = new Map<string, string>();
  for (const r of rows ?? []) {
    const v = r[field];
    if (v != null && String(v).trim() !== "") m.set(normName(String(v)), r.id);
  }
  return m;
};

export default function UploadCenterPage() {
  const { activeOrgId } = useAuth();
  const qc = useQueryClient();
  const [targetKey, setTargetKey] = useState<string>("channels");
  const [csv, setCsv] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importError, setImportError] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const target = useMemo(() => targetByKey(targetKey), [targetKey]);

  // Master lists — used both for FK resolution (plans) and duplicate detection.
  const channelsL = useMasterList("channels", activeOrgId);
  const brandsL = useMasterList("brands", activeOrgId);
  const productsL = useMasterList("products", activeOrgId);
  const mechanicsL = useMasterList("promotion_mechanics", activeOrgId);
  const categoriesL = useMasterList("categories", activeOrgId);
  const customersL = useMasterList("customers", activeOrgId);
  const listByKey: Record<string, ReturnType<typeof useMasterList>> = {
    channels: channelsL, brands: brandsL, products: productsL,
    promotion_mechanics: mechanicsL, categories: categoriesL, customers: customersL,
  };

  const lookups: Lookups = useMemo(() => ({
    channels: nameMap(channelsL.data, "name"),
    brands: nameMap(brandsL.data, "name"),
    products: nameMap(productsL.data, "sku_code"),
    mechanics: nameMap(mechanicsL.data, "name"),
  }), [channelsL.data, brandsL.data, productsL.data, mechanicsL.data]);

  const spec: ImportSpec = useMemo(
    () => ({ key: target.key as MasterEntityKey, label: target.label, fields: target.fields, uniqueField: target.uniqueField ?? "" }),
    [target],
  );

  const existingKeys = useMemo(() => {
    const list = listByKey[target.key];
    if (!target.uniqueField || !list) return new Set<string>();
    return new Set((list.data ?? []).map((r: any) => String(r[target.uniqueField!] ?? "").trim().toLowerCase()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, channelsL.data, brandsL.data, productsL.data, mechanicsL.data, categoriesL.data, customersL.data]);

  const parsed = useMemo(() => (csv.trim() ? parseCsv(csv) : { headers: [], rows: [] }), [csv]);
  const effectiveMapping = useMemo(() => {
    if (parsed.headers.length === 0) return {};
    return { ...autoMap(spec, parsed.headers), ...mapping };
  }, [parsed.headers, spec, mapping]);

  const result = useMemo(
    () => (parsed.headers.length ? validateRows(spec, parsed.headers, parsed.rows, effectiveMapping, existingKeys) : null),
    [spec, parsed, effectiveMapping, existingKeys],
  );

  function selectTarget(k: string) {
    setTargetKey(k); setCsv(""); setMapping({}); setImportMsg(null); setImportError(false);
  }
  function readFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setCsv(String(reader.result ?? "")); setMapping({}); };
    reader.readAsText(file);
  }

  async function commit() {
    if (!supabase || !activeOrgId || !result || result.accepted.length === 0) return;
    setImporting(true); setImportMsg(null); setImportError(false);
    try {
      const { payloads, warnings } = target.build(result.accepted, { lookups });
      const rows = payloads.map((p) => ({ ...p, organization_id: activeOrgId }));
      const { error } = await supabase.from(target.table).insert(rows);
      if (error) throw new Error(error.message);
      const warn = warnings.length ? ` (${warnings.length} warning${warnings.length > 1 ? "s" : ""})` : "";
      setImportMsg(`Imported ${rows.length} ${target.label.toLowerCase()}${warn}.` + (warnings.length ? "\n" + warnings.slice(0, 8).join("\n") : ""));
      setImportError(false);
      setCsv("");
      // Refresh whatever this target feeds.
      qc.invalidateQueries();
    } catch (e) {
      setImportMsg((e as Error).message);
      setImportError(true);
    } finally {
      setImporting(false);
    }
  }

  const groups: Array<"Master data" | "Transactions"> = ["Master data", "Transactions"];

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Upload Center</h1>
        <p className="text-sm text-slate-500">Bulk import from CSV — auto column mapping, validation preview, duplicate detection, rejected-row export. Plans &amp; actuals are scored on import exactly like the forms.</p>
      </header>

      {groups.map((g) => (
        <div key={g} className="mb-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{g}</div>
          <div className="flex flex-wrap gap-2">
            {IMPORT_TARGETS.filter((t) => t.group === g).map((t) => (
              <button key={t.key} onClick={() => selectTarget(t.key)}
                className={`rounded-lg px-3 py-1.5 text-sm ${targetKey === t.key ? "bg-brand text-brand-fg" : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="mb-2 font-semibold">1 · Provide CSV</h3>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); readFile(e.dataTransfer.files?.[0]); }}
            className={`mb-2 rounded-lg border-2 border-dashed p-4 text-center text-sm ${dragOver ? "border-brand bg-brand/5" : "border-slate-300 dark:border-slate-600"}`}
          >
            <p className="text-slate-500">Drag &amp; drop a CSV here, or</p>
            <label className="mt-1 inline-block cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">
              Choose file<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
            </label>
          </div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => { setCsv(templateCsv(target)); setMapping({}); }}>Load template</Button>
            <Button variant="ghost" onClick={() => download(`${target.key}-template.csv`, templateCsv(target))}>Download template</Button>
          </div>
          <textarea
            value={csv} onChange={(e) => { setCsv(e.target.value); setMapping({}); }}
            placeholder={`Paste CSV here, or load the template above.`}
            className="h-40 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs dark:border-slate-600 dark:bg-slate-800"
          />
        </Card>

        <Card>
          <h3 className="mb-2 font-semibold">2 · Map columns</h3>
          {parsed.headers.length === 0 ? (
            <p className="text-sm text-slate-400">Provide CSV to map its columns. Matching headers auto-map.</p>
          ) : (
            <>
              <div className="mb-2 text-xs text-slate-400">
                {spec.fields.filter((f) => effectiveMapping[f.key]).length} of {spec.fields.length} fields mapped
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {spec.fields.map((f) => (
                  <label key={f.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-600 dark:text-slate-300">{f.label}{f.required ? <span className="text-red-500"> *</span> : null}</span>
                    <Select
                      value={effectiveMapping[f.key] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                      className="w-40"
                      error={f.required && !effectiveMapping[f.key]}
                    >
                      <option value="">—</option>
                      {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </Select>
                  </label>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card>
          <h3 className="mb-2 font-semibold">3 · Preview &amp; import</h3>
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
                  onClick={() => download(`${target.key}-rejected.csv`, rejectedToCsv(spec, result.rejected))}>
                  Download rejected rows
                </Button>
              )}
            </div>
          )}
          {importMsg && (
            <p className={`mt-2 whitespace-pre-line text-xs font-medium ${importError ? "text-red-600" : "text-emerald-600"}`}>{importMsg}</p>
          )}
        </Card>
      </div>

      {/* Accepted-row preview — see what WILL be imported before committing. */}
      {result && result.accepted.length > 0 && (
        <Card className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-slate-400">Preview — rows to import</div>
            <span className="text-xs text-slate-400">showing {Math.min(result.accepted.length, 50)} of {result.accepted.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400 dark:border-slate-700">
                  {spec.fields.map((f) => <th key={f.key} className="py-2 pr-4">{f.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {result.accepted.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                    {spec.fields.map((f) => <td key={f.key} className="py-2 pr-4 text-slate-700 dark:text-slate-200">{r[f.key] != null ? String(r[f.key]) : "—"}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {result && result.rejected.length > 0 && (
        <Card className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-slate-400">Rejected rows</div>
            <span className="text-xs text-slate-400">showing {Math.min(result.rejected.length, 50)} of {result.rejected.length}</span>
          </div>
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
