import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth/AuthProvider";
import { Card, Input, Badge, Button } from "../components/ui/primitives";
import { Stat } from "../components/ui/viz";
import { healthTone, toneText } from "../lib/format";
import { useHistory } from "../lib/data/historyData";
import { filterHistory, findDuplicateIds, historyToCsv, type HistoryRow } from "../lib/history/history";

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const STATUS_TONE: Record<string, "slate" | "green" | "amber" | "red"> = {
  draft: "slate", submitted: "amber", under_review: "amber", approved: "green",
  rejected: "red", active: "green", completed: "slate", evaluated: "slate", archived: "slate",
};

type SortKey = "channelName" | "brandName" | "productName" | "mechanicName" | "startDate" | "status" | "decision" | "roi";

const COLS: { key: SortKey; label: string }[] = [
  { key: "channelName", label: "Channel" },
  { key: "brandName", label: "Brand" },
  { key: "productName", label: "SKU" },
  { key: "mechanicName", label: "Mechanic" },
  { key: "startDate", label: "Dates" },
  { key: "status", label: "Status" },
  { key: "decision", label: "Decision" },
  { key: "roi", label: "Net ROI" },
];

// Comparable accessor: numbers sort numerically (nulls last), strings case-insensitively.
function sortVal(r: HistoryRow, k: SortKey): number | string {
  if (k === "roi") return r.roi != null && Number.isFinite(r.roi) ? r.roi : -Infinity;
  const v = r[k];
  return typeof v === "string" ? v.toLowerCase() : "";
}

export default function HistoryPage() {
  const { activeOrgId } = useAuth();
  const query = useHistory(activeOrgId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [channelId, setChannelId] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("roi");
  const [asc, setAsc] = useState(false);

  const rows = query.data ?? [];
  const statuses = useMemo(() => ["all", ...new Set(rows.map((r) => r.status))], [rows]);
  const channels = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => { if (r.channelId) m.set(r.channelId, r.channelName); });
    return [...m];
  }, [rows]);

  const filtered = useMemo(() => filterHistory(rows, { search, status, channelId }), [rows, search, status, channelId]);
  const dupIds = useMemo(() => findDuplicateIds(rows), [rows]);

  // Status counts for the summary strip — computed over the current filtered set.
  const statusCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.status, (m.get(r.status) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const sorted = useMemo(() => {
    const dir = asc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = sortVal(a, sortKey);
      const vb = sortVal(b, sortKey);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [filtered, sortKey, asc]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setAsc((v) => !v);
    else { setSortKey(k); setAsc(false); }
  };

  return (
    <div>
      <header className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Promotion History</h1>
          <p className="text-sm text-slate-500">Searchable record of every saved plan, with duplicate detection and export.</p>
        </div>
        <Button variant="ghost" disabled={sorted.length === 0} onClick={() => download("promotion-history.csv", historyToCsv(sorted))}>
          Export CSV
        </Button>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input className="w-56" placeholder="Search brand, SKU, channel, notes…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">
          {statuses.map((s) => <option key={s} value={s}>{s === "all" ? "All statuses" : s}</option>)}
        </select>
        <select value={channelId} onChange={(e) => setChannelId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">
          <option value="all">All channels</option>
          {channels.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <span className="ml-auto text-sm text-slate-500">{filtered.length} of {rows.length}{dupIds.size > 0 ? ` · ${dupIds.size} duplicate(s)` : ""}</span>
      </div>

      {statusCounts.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Plans" value={filtered.length} hint="Matching filters" />
          {statusCounts.map(([s, n]) => (
            <Stat
              key={s}
              label={s}
              value={n}
              tone={STATUS_TONE[s] ?? "slate"}
            />
          ))}
        </div>
      )}

      <Card>
        {query.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {query.isError && <p className="text-sm text-red-600">{(query.error as Error).message}</p>}
        {!query.isLoading && sorted.length === 0 && <p className="text-sm text-slate-400">No plans match.</p>}
        {sorted.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400 dark:border-slate-700">
                  {COLS.map((c) => (
                    <th
                      key={c.key}
                      className={`cursor-pointer py-2 pr-4 hover:text-slate-600 ${c.key === "roi" ? "min-w-[9rem]" : ""}`}
                      onClick={() => toggle(c.key)}
                    >
                      {c.label}{sortKey === c.key ? (asc ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                  <th className="py-2 pr-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const roiTone = r.roi != null && Number.isFinite(r.roi) ? healthTone(r.roi, { good: 1, warn: 0 }) : "slate";
                  return (
                    <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 pr-4">
                        {r.channelName}
                        {dupIds.has(r.id) && <Badge tone="amber">dup</Badge>}
                      </td>
                      <td className="py-2 pr-4">{r.brandName}</td>
                      <td className="py-2 pr-4">{r.productName}</td>
                      <td className="py-2 pr-4">{r.mechanicName}</td>
                      <td className="py-2 pr-4 text-slate-500">{r.startDate ? `${r.startDate} → ${r.endDate}` : "—"}</td>
                      <td className="py-2 pr-4"><Badge tone={STATUS_TONE[r.status] ?? "slate"}>{r.status}</Badge></td>
                      <td className="py-2 pr-4">{r.decision ?? "—"}</td>
                      <td className="min-w-[9rem] py-2 pr-4">
                        {r.roi != null && Number.isFinite(r.roi)
                          ? <span className={`font-medium tabular-nums ${toneText[roiTone]}`}>{r.roi.toFixed(2)}</span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-2 pr-4 max-w-[16rem] truncate text-slate-500">{r.notes ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
