import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth/AuthProvider";
import { Card, Badge } from "../components/ui/primitives";
import { RankBars } from "../components/ui/viz";
import { compact, toneFill, type Tone } from "../lib/format";
import { buildCalendar, type CalPlan } from "../lib/calendar/calendar";
import { useCalendarPlans } from "../lib/data/calendarData";

const money = (v: number, cur = "AED") => `${cur} ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const STATUS_TONE: Record<string, Tone> = {
  draft: "slate", submitted: "amber", under_review: "amber", approved: "green",
  rejected: "red", active: "green", completed: "slate", evaluated: "slate", archived: "slate",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (key: string) => `${MONTH_NAMES[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`;

// Portion of a YYYY-MM month covered by a promo's [startDate, endDate] range,
// as {offset, width} percentages for a within-month timeline bar. Uses the
// startDate/endDate already on CalPlan — presentation only, no engine change.
function monthSpan(key: string, p: CalPlan): { offset: number; width: number } | null {
  if (!p.startDate || !p.endDate) return null;
  const y = +key.slice(0, 4);
  const mo = +key.slice(5, 7);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const monthStart = `${key}-01`;
  const monthEnd = `${key}-${String(daysInMonth).padStart(2, "0")}`;
  const s = p.startDate > monthStart ? p.startDate : monthStart;
  const e = p.endDate < monthEnd ? p.endDate : monthEnd;
  if (s > e) return null;
  const sDay = +s.slice(8, 10);
  const eDay = +e.slice(8, 10);
  return {
    offset: ((sDay - 1) / daysInMonth) * 100,
    width: (Math.max(1, eDay - sDay + 1) / daysInMonth) * 100,
  };
}

// Continuous year-timeline (Gantt): every dated promo as a bar across a shared
// month axis, so duration and overlaps are visible at a glance.
function YearTimeline({ plans, conflictIds }: { plans: CalPlan[]; conflictIds: Set<string> }) {
  const dated = useMemo(
    () => plans
      .filter((p) => p.startDate && p.endDate && (p.startDate as string) <= (p.endDate as string))
      .sort((a, b) => (a.startDate as string).localeCompare(b.startDate as string)),
    [plans],
  );
  if (dated.length === 0) return null;

  const times = dated.flatMap((p) => [Date.parse(p.startDate as string), Date.parse(p.endDate as string)]);
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = max - min || 1;
  const pos = (t: number) => Math.max(0, Math.min(100, ((t - min) / span) * 100));

  // month gridline ticks
  const ticks: Array<{ t: number; label: string }> = [];
  const cur = new Date(min);
  cur.setDate(1);
  let guard = 0;
  while (cur.getTime() <= max && guard++ < 60) {
    ticks.push({ t: cur.getTime(), label: `${MONTH_NAMES[cur.getMonth()]} '${String(cur.getFullYear()).slice(2)}` });
    cur.setMonth(cur.getMonth() + 1);
  }

  return (
    <Card className="mb-4">
      <div className="mb-2 text-xs font-semibold uppercase text-slate-400">Timeline</div>
      <div className="max-h-[26rem] space-y-1 overflow-y-auto pr-1">
        {/* month axis */}
        <div className="flex items-end gap-2">
          <span className="w-40 shrink-0" />
          <div className="relative h-4 flex-1">
            {ticks.map((tk, i) => (
              <span key={i} className="absolute -translate-x-1/2 text-[10px] text-slate-400" style={{ left: `${pos(tk.t)}%` }}>{tk.label}</span>
            ))}
          </div>
        </div>
        {dated.map((p) => {
          const conflicted = conflictIds.has(p.id);
          const tone: Tone = conflicted ? "red" : STATUS_TONE[p.status] ?? "slate";
          const l = pos(Date.parse(p.startDate as string));
          const w = Math.max(1.5, pos(Date.parse(p.endDate as string)) - l);
          return (
            <div key={p.id} className="flex items-center gap-2">
              <span className="w-40 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300" title={p.label}>{p.label}</span>
              <div className="relative h-4 flex-1 rounded bg-slate-50 dark:bg-slate-800/60">
                {ticks.map((tk, i) => (
                  <span key={i} className="absolute inset-y-0 w-px bg-slate-200 dark:bg-slate-700" style={{ left: `${pos(tk.t)}%` }} />
                ))}
                <div
                  className={`absolute inset-y-0.5 rounded ${toneFill[tone]}`}
                  style={{ left: `${l}%`, width: `${w}%` }}
                  title={`${p.label}: ${p.startDate} → ${p.endDate}${conflicted ? " (overlap)" : ""}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function PromotionCalendarPage() {
  const { activeOrgId } = useAuth();
  const query = useCalendarPlans(activeOrgId);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const plans = query.data ?? [];
  const statuses = useMemo(() => ["all", ...new Set(plans.map((p) => p.status))], [plans]);
  const filtered = useMemo(
    () => (statusFilter === "all" ? plans : plans.filter((p) => p.status === statusFilter)),
    [plans, statusFilter],
  );
  const cal = useMemo(() => buildCalendar(filtered), [filtered]);
  const byId = useMemo(() => Object.fromEntries(plans.map((p) => [p.id, p])), [plans]);
  // Plans involved in an overlap — toned red on the timeline.
  const conflictIds = useMemo(() => {
    const s = new Set<string>();
    cal.conflicts.forEach((c) => { s.add(c.aId); s.add(c.bId); });
    return s;
  }, [cal.conflicts]);

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Promotion Calendar</h1>
        <p className="text-sm text-slate-500">Planned, active and completed promotions by month — with overlap detection and spend by month.</p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {statuses.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm ${statusFilter === s ? "bg-brand text-brand-fg" : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
            {s}
          </button>
        ))}
        <span className="ml-auto text-sm text-slate-500">Total spend: <span className="font-semibold">{money(cal.totalSpend)}</span></span>
      </div>

      {query.isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      {cal.conflicts.length > 0 && (
        <Card className="mb-4 border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200">
          <div className="text-xs font-semibold uppercase">⚠ Conflicts ({cal.conflicts.length})</div>
          <ul className="mt-1 list-inside list-disc text-sm">
            {cal.conflicts.map((c, i) => (
              <li key={i}>"{c.aLabel}" overlaps "{c.bLabel}" — {c.reason}</li>
            ))}
          </ul>
        </Card>
      )}

      {!query.isLoading && cal.months.length === 0 && (
        <Card><p className="text-sm text-slate-400">No dated promotions{statusFilter !== "all" ? " for this status" : ""}. Add start/end dates on plans in the Planner.</p></Card>
      )}

      <YearTimeline plans={filtered} conflictIds={conflictIds} />

      {cal.months.length > 0 && (
        <Card className="mb-4">
          <div className="mb-2 text-xs font-semibold uppercase text-slate-400">Spend by month</div>
          <RankBars
            data={cal.months.map((m) => ({
              label: monthLabel(m.key),
              value: m.spend,
              display: `AED ${compact(m.spend)}`,
              tone: "green",
            }))}
          />
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cal.months.map((m) => (
          <Card key={m.key}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">{monthLabel(m.key)}</h3>
              <span className="text-xs text-slate-500">{money(m.spend)}</span>
            </div>
            <ul className="space-y-2.5">
              {m.planIds.map((id) => {
                const p: CalPlan | undefined = byId[id];
                if (!p) return null;
                const conflicted = conflictIds.has(p.id);
                const tone: Tone = conflicted ? "red" : STATUS_TONE[p.status] ?? "slate";
                const span = monthSpan(m.key, p);
                return (
                  <li key={id} className="text-sm">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-slate-700 dark:text-slate-200" title={p.label}>{p.label}</span>
                      <Badge tone={tone}>{conflicted ? "conflict" : p.status}</Badge>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      {span && (
                        <div
                          className={`absolute inset-y-0 rounded-full ${toneFill[tone]}`}
                          style={{ left: `${span.offset}%`, width: `${span.width}%` }}
                          title={`${p.startDate} → ${p.endDate}`}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>

      {cal.undated.length > 0 && (
        <Card className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase text-slate-400">Undated / invalid-range plans ({cal.undated.length})</div>
          <ul className="space-y-1 text-sm">
            {cal.undated.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-slate-600 dark:text-slate-300">{p.label}</span>
                <Badge tone={STATUS_TONE[p.status] ?? "slate"}>{p.status}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-400">Add start and end dates in the Planner to place these on the calendar.</p>
        </Card>
      )}
    </div>
  );
}
