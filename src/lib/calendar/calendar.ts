// PromoLift — Promotion Calendar (docs module I).
// Buckets plans into the months they span, detects overlapping promotions on the
// same SKU+channel (conflicts), and sums spend by month. Pure string-based date
// handling (ISO YYYY-MM-DD sorts lexically) — deterministic, no Date dependency.

export interface CalPlan {
  id: string;
  label: string;
  channelId: string | null;
  productId: string | null;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;
  status: string;
  totalInvestment: number | null;
}

export interface MonthBucket {
  key: string;   // YYYY-MM
  label: string; // e.g. "2026-08"
  planIds: string[];
  spend: number; // spend whose start month is this month
}

export interface Conflict {
  aId: string; bId: string; aLabel: string; bLabel: string; reason: string;
}

export interface CalendarResult {
  months: MonthBucket[];
  conflicts: Conflict[];
  undated: CalPlan[];
  totalSpend: number;
}

const ym = (isoDate: string): string => isoDate.slice(0, 7);

/** Inclusive list of YYYY-MM keys from startYM to endYM. */
function monthsBetween(startYM: string, endYM: string): string[] {
  const out: string[] = [];
  let y = +startYM.slice(0, 4);
  let m = +startYM.slice(5, 7);
  const ey = +endYM.slice(0, 4);
  const em = +endYM.slice(5, 7);
  let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard < 600) {
    out.push(`${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    guard++;
  }
  return out;
}

/** Two plans overlap if same SKU + channel and their date ranges intersect. */
function overlaps(a: CalPlan, b: CalPlan): boolean {
  if (!a.startDate || !a.endDate || !b.startDate || !b.endDate) return false;
  if (a.productId !== b.productId || a.channelId !== b.channelId) return false;
  if (!a.productId || !a.channelId) return false;
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

export function buildCalendar(plans: CalPlan[]): CalendarResult {
  const isDated = (p: CalPlan): boolean =>
    Boolean(p.startDate && p.endDate && (p.startDate as string) <= (p.endDate as string));
  const dated = plans.filter(isDated);
  const undated = plans.filter((p) => !isDated(p)); // missing OR invalid (end < start) ranges

  const bucketMap = new Map<string, MonthBucket>();
  const touch = (key: string): MonthBucket => {
    let b = bucketMap.get(key);
    if (!b) { b = { key, label: key, planIds: [], spend: 0 }; bucketMap.set(key, b); }
    return b;
  };

  let totalSpend = 0;
  for (const p of dated) {
    const span = monthsBetween(ym(p.startDate as string), ym(p.endDate as string));
    for (const key of span) touch(key).planIds.push(p.id);
    // spend booked to the start month
    const spend = typeof p.totalInvestment === "number" && Number.isFinite(p.totalInvestment) ? p.totalInvestment : 0;
    touch(ym(p.startDate as string)).spend += spend;
    totalSpend += spend;
  }

  // Conflicts: overlapping promos on the same SKU+channel.
  const conflicts: Conflict[] = [];
  for (let i = 0; i < dated.length; i++) {
    for (let j = i + 1; j < dated.length; j++) {
      if (overlaps(dated[i], dated[j])) {
        conflicts.push({
          aId: dated[i].id, bId: dated[j].id,
          aLabel: dated[i].label, bLabel: dated[j].label,
          reason: "Overlapping dates on the same SKU + channel.",
        });
      }
    }
  }

  const months = [...bucketMap.values()].sort((a, b) => a.key.localeCompare(b.key));
  return { months, conflicts, undated, totalSpend: Math.round(totalSpend * 100) / 100 };
}
