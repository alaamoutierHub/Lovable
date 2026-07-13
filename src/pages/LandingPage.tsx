import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth/AuthProvider";

// Public marketing homepage. Original design + copy tailored to eCommerce /
// commercial teams. Auth-aware CTAs route into the real signup/login flow.

const CHANNELS = ["Amazon", "Noon", "Talabat Mart", "Careem Quik", "Carrefour", "Mumzworld", "Instashop", "Kibsons"];

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d={path} />
    </svg>
  );
}

const FEATURES = [
  { title: "Channel & SKU growth ranking", body: "See which channels and SKUs respond best to investment — ranked by real incremental revenue, not gut feel.", icon: "M3 3v18h18 M7 15l4-4 3 3 5-6" },
  { title: "Promotion planner + break-even", body: "Model any mechanic before you commit. Get planned ROI, ASP dilution, break-even uplift, and an Approve / Test / Revise call.", icon: "M9 11l3 3 8-8 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { title: "Budget optimizer", body: "Tell it your budget and constraints; it recommends where the next dirham goes — with diminishing returns and concentration caps.", icon: "M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { title: "Post-promo evaluation", body: "Record actuals, get variance vs forecast, forecast accuracy, and a clear outcome — Scale, Maintain, Revise, or Stop.", icon: "M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4 12 14.01l-3-3" },
  { title: "Explainable recommendations", body: "Every score shows its drivers, confidence, and data-quality flags. Guardrails stop you scaling on thin data.", icon: "M12 16v-4 M12 8h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z" },
  { title: "AI management summaries", body: "One click turns the numbers into an executive narrative — findings, risks, and recommended budget shifts.", icon: "M12 2a7 7 0 0 0-4 12.7V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.3A7 7 0 0 0 12 2z M9 21h6" },
];

const STEPS = [
  { n: "1", title: "Plan", body: "Build a promotion with a baseline, mechanic, and investment. See the economics before you spend." },
  { n: "2", title: "Evaluate", body: "Load actuals. Get incremental revenue, ROI, forecast accuracy, and the outcome classification." },
  { n: "3", title: "Optimize", body: "Compare channels, SKUs and mechanics, then let the optimizer place your next budget where it grows revenue." },
];

const DIFFERENTIATORS = [
  { title: "No margin or P&L data needed", body: "Works entirely on revenue growth, incremental sales, uplift and investment efficiency — nothing sensitive to import." },
  { title: "Deterministic & auditable", body: "Every metric uses a fixed formula with full provenance. AI explains the numbers; it never invents them." },
  { title: "Secure multi-tenant by design", body: "Row-level security isolates every organization. Roles control who can view, edit, approve, and export." },
];

export default function LandingPage() {
  const { user } = useAuth();
  const primaryTo = user ? "/overview" : "/auth?signup=1";
  const primaryLabel = user ? "Go to dashboard" : "Get started free";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-fg">P</span>
            PromoLift
          </div>
          <nav className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#how" className="hover:text-slate-900">How it works</a>
            <a href="#why" className="hover:text-slate-900">Why PromoLift</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="text-sm font-medium text-slate-600 hover:text-slate-900">Log in</Link>
            <Link to={primaryTo} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:opacity-90">
              {user ? "Dashboard" : "Get started"}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-teal-50 via-white to-white" />
        <div className="absolute -top-24 left-1/2 -z-10 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-teal-200/40 blur-3xl" />
        <div className="mx-auto max-w-6xl px-6 py-20 text-center md:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
            ● Built for eCommerce & commercial teams
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-6xl">
            Know exactly where your next promo <span className="text-brand">dirham</span> drives growth.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            PromoLift shows which channels, SKUs, campaigns and mechanics generate the strongest revenue
            growth — and where to invest the next budget. No COGS, margin or P&L data required.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to={primaryTo} className="rounded-xl bg-brand px-6 py-3 text-base font-semibold text-brand-fg shadow-sm hover:opacity-90">
              {primaryLabel}
            </Link>
            <a href="#features" className="rounded-xl border border-slate-300 px-6 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50">
              See what it does
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-400">Self-serve · your data stays isolated · decision-support, not a calculator</p>
        </div>

        {/* Channel trust strip */}
        <div className="mx-auto max-w-5xl px-6 pb-16">
          <p className="mb-5 text-center text-xs font-medium uppercase tracking-wider text-slate-400">
            Plan across the retail-media channels you already sell on
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {CHANNELS.map((c) => (
              <span key={c} className="text-sm font-semibold text-slate-400">{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Value prop band */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-10 text-center md:grid-cols-4">
          {[
            ["Incremental revenue", "Not vanity uplift — true growth vs a clean baseline"],
            ["Revenue ROI", "Net return per dirham invested, re-derived correctly"],
            ["Forecast accuracy", "Plan vs actual, tracked every campaign"],
            ["Where to invest next", "Confidence-weighted budget allocation"],
          ].map(([h, b]) => (
            <div key={h}>
              <div className="text-sm font-bold text-slate-900">{h}</div>
              <div className="mt-1 text-xs text-slate-500">{b}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Everything to plan, prove and grow promotions</h2>
          <p className="mt-4 text-slate-600">From a single plan to a portfolio-wide budget decision — all deterministic, all explainable.</p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-brand">
                <Icon path={f.icon} />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Plan → Evaluate → Optimize</h2>
            <p className="mt-4 text-slate-600">A closed loop that turns every campaign into a sharper next decision.</p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-slate-200 bg-white p-7">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-brand text-lg font-bold text-brand-fg">{s.n}</div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why PromoLift */}
      <section id="why" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Why commercial teams choose PromoLift</h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {DIFFERENTIATORS.map((d) => (
            <div key={d.title} className="rounded-2xl border border-slate-200 p-6">
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-teal-50 text-brand">
                <Icon path="M20 6 9 17l-5-5" />
              </div>
              <h3 className="font-semibold text-slate-900">{d.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 to-teal-800 px-8 py-14 text-center text-white shadow-lg">
          <h2 className="text-3xl font-bold md:text-4xl">Stop guessing which promotions pay off.</h2>
          <p className="mx-auto mt-3 max-w-xl text-teal-50">
            Create your workspace in minutes and turn promotional spend into predictable revenue growth.
          </p>
          <Link to={primaryTo} className="mt-8 inline-block rounded-xl bg-white px-6 py-3 text-base font-semibold text-teal-800 hover:bg-teal-50">
            {primaryLabel}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2 font-semibold text-slate-700">
            <span className="grid h-6 w-6 place-items-center rounded bg-brand text-xs text-brand-fg">P</span>
            PromoLift
          </div>
          <p>Multi-Channel Growth &amp; Investment Planner</p>
          <div className="flex gap-6">
            <Link to="/auth" className="hover:text-slate-900">Log in</Link>
            <Link to={primaryTo} className="hover:text-slate-900">Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
