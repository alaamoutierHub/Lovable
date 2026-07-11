import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth/AuthProvider";
import { ROLE_LABELS } from "../lib/auth/permissions";
import { supabase } from "../lib/supabase/client";
import { Button, Card, Field, Input } from "../components/ui/primitives";

const NAV: Array<{ to: string; label: string }> = [
  { to: "/", label: "Overview" },
  { to: "/planner", label: "Promotion Planner" },
  { to: "/evaluations", label: "Evaluations" },
  { to: "/scenarios", label: "Scenarios" },
  { to: "/channels", label: "Channel Comparison" },
  { to: "/matrix", label: "SKU-Channel Matrix" },
  { to: "/optimizer", label: "Budget Optimizer" },
  { to: "/calendar", label: "Promotion Calendar" },
  { to: "/history", label: "History" },
  { to: "/reports", label: "Reports" },
  { to: "/uploads", label: "Uploads" },
  { to: "/settings/master-data", label: "Settings" },
];

export default function AppShell() {
  const { memberships, activeOrgId, setActiveOrgId, role, user, signOut } = useAuth();

  if (memberships.length === 0) return <CreateOrgOnboarding />;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4">
          <div className="text-lg font-bold text-slate-900 dark:text-slate-50">PromoLift</div>
          <select
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
            value={activeOrgId ?? ""}
            onChange={(e) => setActiveOrgId(e.target.value)}
          >
            {memberships.map((m) => (
              <option key={m.organizationId} value={m.organizationId}>{m.organizationName}</option>
            ))}
          </select>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm ${
                  isActive
                    ? "bg-brand text-brand-fg"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800">
          <div className="truncate">{user?.email}</div>
          <div>{role ? ROLE_LABELS[role] : "—"}</div>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => signOut()}>Sign out</Button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden p-6">
        <Outlet />
      </main>
    </div>
  );
}

function CreateOrgOnboarding() {
  const { refreshMemberships } = useAuth();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!supabase) return setErr("Supabase not connected.");
    setBusy(true);
    try {
      const { error } = await supabase.rpc("create_organization", {
        org_name: name,
        reporting_currency: currency,
      });
      if (error) throw error;
      await refreshMemberships();
    } catch (e: any) {
      setErr(e.message ?? "Failed to create organization.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <Card className="w-full max-w-sm">
        <h2 className="text-lg font-semibold">Create your organization</h2>
        <p className="mb-4 text-sm text-slate-500">You'll be the owner. You can invite others later.</p>
        <form onSubmit={create} className="space-y-3">
          <Field label="Organization name">
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Reporting currency">
            <Input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </Field>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? "…" : "Create organization"}</Button>
        </form>
      </Card>
    </div>
  );
}
