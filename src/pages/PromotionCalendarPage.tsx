import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth/AuthProvider";
import { Card, Badge } from "../components/ui/primitives";
import { buildCalendar, type CalPlan } from "../lib/calendar/calendar";
import { useCalendarPlans } from "../lib/data/calendarData";

const money = (v: number, cur = "AED") => `${cur} ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const STATUS_TONE: Record<string, "slate" | "green" | "amber" | "red"> = {
  draft: "slate", submitted: "amber", under_review: "amber", approved: "green",
  rejected: "red", active: "green", completed: "slate", evaluated: "slate", archived: "slate",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (key: string) => `${MONTH_NAMES[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`;

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cal.months.map((m) => (
          <Card key={m.key}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">{monthLabel(m.key)}</h3>
              <span className="text-xs text-slate-500">{money(m.spend)}</span>
            </div>
            <ul className="space-y-1">
              {m.planIds.map((id) => {
                const p: CalPlan | undefined = byId[id];
                if (!p) return null;
                return (
                  <li key={id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-slate-700 dark:text-slate-200">{p.label}</span>
                    <Badge tone={STATUS_TONE[p.status] ?? "slate"}>{p.status}</Badge>
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
