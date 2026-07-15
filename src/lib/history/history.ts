// Commerly — Promotion History (docs module J): filtering, duplicate detection,
// and CSV export over saved plans. Pure + deterministic.

export interface HistoryRow {
  id: string;
  channelId: string | null;
  channelName: string;
  brandName: string;
  productId: string | null;
  productName: string;
  mechanicId: string | null;
  mechanicName: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  decision: string | null;
  roi: number | null;
  dqScore: number | null;
  notes: string | null;
  createdAt: string | null;
}

export interface HistoryFilter {
  search?: string;
  status?: string;      // "all" or a status
  channelId?: string;   // "all" or an id
}

/** Duplicate key = same channel + SKU + mechanic + date window. */
export function duplicateKey(r: HistoryRow): string {
  return [r.channelId ?? "", r.productId ?? "", r.mechanicId ?? "", r.startDate ?? "", r.endDate ?? ""].join("|");
}

/** Returns the set of row ids that belong to a duplicate group (>1 sharing a key). */
export function findDuplicateIds(rows: HistoryRow[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const r of rows) {
    // ignore rows that lack the identifying fields entirely
    if (!r.channelId && !r.productId && !r.mechanicId && !r.startDate) continue;
    const k = duplicateKey(r);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r.id);
  }
  const dups = new Set<string>();
  for (const ids of groups.values()) if (ids.length > 1) ids.forEach((id) => dups.add(id));
  return dups;
}

export function filterHistory(rows: HistoryRow[], f: HistoryFilter): HistoryRow[] {
  const q = (f.search ?? "").trim().toLowerCase();
  return rows.filter((r) => {
    if (f.status && f.status !== "all" && r.status !== f.status) return false;
    if (f.channelId && f.channelId !== "all" && r.channelId !== f.channelId) return false;
    if (q) {
      const hay = [r.channelName, r.brandName, r.productName, r.mechanicName, r.notes ?? ""].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function historyToCsv(rows: HistoryRow[]): string {
  const cols = [
    "channel", "brand", "sku", "mechanic", "start", "end",
    "status", "decision", "net_roi", "dq_score", "notes",
  ];
  const lines = rows.map((r) =>
    [
      r.channelName, r.brandName, r.productName, r.mechanicName,
      r.startDate ?? "", r.endDate ?? "", r.status, r.decision ?? "",
      r.roi != null ? r.roi.toFixed(2) : "", r.dqScore != null ? String(r.dqScore) : "",
      r.notes ?? "",
    ].map((v) => esc(String(v))).join(","),
  );
  return [cols.join(","), ...lines].join("\n");
}
