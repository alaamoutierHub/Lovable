import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth/AuthProvider";

// Public marketing homepage. Light-themed editorial design; original copy for
// eCommerce / commercial teams. Auth-aware CTAs route into the real signup/login.

const GOLD = "#C6871F";

function Ico({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}
const Check = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 6 9 17l-5-5" /></svg>
);

const FEATURES = [
  { t: "Channel & SKU growth ranking", d: "See which channels and SKUs respond best to investment — ranked by real incremental revenue and net ROI, re-derived correctly, never averaged.", icon: "M3 3v18h18 M7 15l4-4 3 3 5-6" },
  { t: "Promotion planner & break-even", d: "Model any mechanic before you commit. Planned ROI, ASP dilution, break-even uplift and a clear Approve / Test / Revise call — with data-quality checks built in.", icon: "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11 M9 11l3 3 8-8" },
  { t: "Budget optimizer", d: "Set your budget and constraints; it recommends where the next dirham goes — with diminishing returns, concentration caps and confidence weighting baked in.", icon: "M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { t: "Post-promotion evaluation", d: "Record actuals and get variance vs forecast, forecast accuracy, and an outcome you can act on — Scale, Maintain, Revise or Stop.", icon: "M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4 12 14.01l-3-3" },
  { t: "Explainable recommendations", d: "Every score shows its drivers, confidence and data-quality flags. Guardrails stop you scaling on thin samples or supply-constrained growth.", icon: "M12 16v-4 M12 8h.01 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
  { t: "AI management summaries", d: "One click turns the numbers into an executive narrative — findings, risks and recommended budget shifts. AI explains the results; it never invents them.", icon: "M12 2a7 7 0 0 0-4 12.7V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.3A7 7 0 0 0 12 2z M9 21h6" },
];

const STEPS = [
  { n: "1", t: "Plan", d: "Build a promotion with a baseline, mechanic and investment. See incremental revenue, ROI and break-even before you spend a dirham." },
  { n: "2", t: "Evaluate", d: "Load actuals. Get variance vs forecast, forecast accuracy and a clear outcome — was it worth it, and why." },
  { n: "3", t: "Optimize", d: "Compare channels, SKUs and mechanics, then let the optimizer place your next budget where it grows revenue most." },
];

const MOCK = [
  { sku: "Wipes 72s", ch: "Amazon", inc: "AED 24,000", roi: "2.33", band: "Scale", tone: "bg-emerald-50 text-emerald-700" },
  { sku: "Diapers M", ch: "Noon", inc: "AED 9,400", roi: "1.10", band: "Maintain", tone: "bg-teal-50 text-teal-700" },
  { sku: "Wipes 72s", ch: "Careem Quik", inc: "AED 3,200", roi: "0.42", band: "Test", tone: "bg-amber-50 text-amber-700" },
  { sku: "Diapers M", ch: "Carrefour", inc: "AED 1,050", roi: "0.08", band: "Test", tone: "bg-amber-50 text-amber-700" },
];

const PRICING = [
  { name: "Starter", price: "Free", per: "", desc: "For a single brand getting promotions under control.", feats: ["Planner, evaluation & calendar", "Channel & SKU comparison", "CSV import & exports"], cta: "Get started", featured: false },
  { name: "Growth", price: "$149", per: " / mo", desc: "For teams optimizing spend across brands and channels.", feats: ["Everything in Starter", "Budget optimizer & scenarios", "AI management summaries", "Integrations & analytics"], cta: "Start free trial", featured: true },
  { name: "Enterprise", price: "Custom", per: "", desc: "For organizations with governance and scale needs.", feats: ["Roles, approvals & audit", "SSO & brand/channel scoping", "Custom integrations & support"], cta: "Talk to us", featured: false },
];

const FAQ = [
  { q: "Do I need margin, COGS or P&L data?", a: "No. PromoLift is built entirely around revenue growth, incremental sales, uplift and investment efficiency. You never import margin or profit data." },
  { q: "Which channels does it support?", a: "Amazon, Noon, Talabat Mart, Careem Quik, Carrefour, Mumzworld, Instashop, Kibsons and more — and you can add any custom channel your team sells on." },
  { q: "How are recommendations calculated?", a: "Every metric uses a fixed, documented formula. A transparent scoring engine normalizes them, applies guardrails, and shows the drivers and confidence behind each recommendation. AI only writes the narrative — it never computes the numbers." },
  { q: "Is my data isolated from other companies?", a: "Yes. Every organization is isolated by row-level security, verified with live cross-tenant tests. Roles control who can view, edit, approve and export." },
  { q: "Can I bring existing data in?", a: "Yes — enter plans manually or bulk-import via CSV/Excel with column mapping, validation, duplicate detection and a rejected-row export. Standard templates are provided." },
];

export default function LandingPage() {
  const { user } = useAuth();
  const signupTo = user ? "/overview" : "/auth?signup=1";
  const primaryLabel = user ? "Go to dashboard" : "Start free";
  const dotGrid: React.CSSProperties = {
    backgroundImage: "radial-gradient(rgba(15,118,110,.10) 1.25px, transparent 1.25px)",
    backgroundSize: "26px 26px",
    WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 28%, #000 40%, transparent 78%)",
    maskImage: "radial-gradient(ellipse 80% 60% at 50% 28%, #000 40%, transparent 78%)",
  };

  return (
    <div className="min-h-screen bg-white text-slate-600" style={{ colorScheme: "light" }}>
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5 font-extrabold tracking-tight text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-teal-600 to-teal-500 text-sm text-white">P</span>
            PromoLift
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-500 md:flex">
            <a href="#features" className="hover:text-slate-900">Platform</a>
            <a href="#process" className="hover:text-slate-900">How it works</a>
            <a href="#why" className="hover:text-slate-900">Why PromoLift</a>
            <a href="#pricing" className="hover:text-slate-900">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="hidden text-sm font-semibold text-slate-700 hover:text-teal-700 sm:block">Log in</Link>
            <Link to={signupTo} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600">
              {user ? "Dashboard" : "Get started"}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={dotGrid} />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 py-20 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-teal-700">
              <span className="h-px w-6 bg-teal-700" /> Promotional investment planning
            </span>
            <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 md:text-6xl">
              Put your next promo <span style={{ color: GOLD }}>dirham</span> where the growth actually is.
            </h1>
            <p className="mt-6 max-w-md text-lg text-slate-600">
              PromoLift ranks every channel, SKU, campaign and mechanic by the revenue growth it really drives —
              then tells you where to invest next. No COGS, margin or P&amp;L data required.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={signupTo} className="rounded-xl bg-teal-700 px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-teal-600">{primaryLabel}</Link>
              <a href="#features" className="rounded-xl border border-slate-300 px-6 py-3.5 text-base font-semibold text-slate-800 hover:bg-slate-50">See the platform</a>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Self-serve · your data stays isolated · a decision platform, not a calculator
            </p>
          </div>

          {/* Product mock */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-sm font-bold text-slate-800">Where to invest next — Q3</span>
              <span className="flex gap-1.5">{[0, 1, 2].map((i) => <i key={i} className="h-2 w-2 rounded-full bg-slate-300" />)}</span>
            </div>
            <div className="p-2">
              <div className="grid grid-cols-[1.4fr_.9fr_.7fr_.9fr] gap-2 px-3 py-2 text-[0.62rem] font-medium uppercase tracking-wider text-slate-400">
                <span>SKU · Channel</span><span>Incremental</span><span>ROI</span><span>Call</span>
              </div>
              {MOCK.map((r, i) => (
                <div key={i} className="grid grid-cols-[1.4fr_.9fr_.7fr_.9fr] items-center gap-2 rounded-lg px-3 py-2.5 hover:bg-slate-50">
                  <span className="text-sm font-semibold text-slate-800">{r.sku}<span className="block text-xs font-normal text-slate-400">{r.ch}</span></span>
                  <span className="font-mono text-sm tabular-nums text-slate-800">{r.inc}</span>
                  <span className="font-mono text-sm tabular-nums text-slate-800">{r.roi}</span>
                  <span className={`justify-self-start rounded-full px-2.5 py-1 text-xs font-bold ${r.tone}`}>{r.band}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <Ico d="M12 16v-4 M12 8h.01 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" className="h-3.5 w-3.5" /> Ranked on incremental revenue &amp; net ROI · every score explainable
            </div>
          </div>
        </div>
      </section>

      {/* Channel strip */}
      <div className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <p className="mb-3.5 text-center text-xs uppercase tracking-[0.1em] text-slate-400">Plan across the retail-media channels you already sell on</p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {["Amazon", "Noon", "Talabat Mart", "Careem Quik", "Carrefour", "Mumzworld", "Instashop", "Kibsons"].map((c) => (
              <span key={c} className="text-[0.95rem] font-bold text-slate-400">{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="border-b border-slate-200 bg-slate-50 py-12">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 text-center md:grid-cols-4">
          {[["24", "", "KPIs on the executive dashboard"], ["8", "+", "retail-media channels, plus your own"], ["0", "", "margin or P&L data needed to start"], ["100", "%", "deterministic, auditable formulas"]].map(([k, u, d]) => (
            <div key={d}>
              <div className="font-mono text-4xl font-extrabold tabular-nums text-slate-900">{k}<span style={{ color: GOLD }}>{u}</span></div>
              <div className="mt-2 text-sm text-slate-500">{d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-teal-700">The platform</span>
          <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">Everything to plan, prove and grow promotions</h2>
          <p className="mt-4 text-lg text-slate-600">From a single plan to a portfolio-wide budget decision — deterministic where it counts, explainable everywhere.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.t} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-teal-700"><Ico d={f.icon} className="h-6 w-6" /></div>
              <h3 className="mt-4 font-bold text-slate-900">{f.t}</h3>
              <p className="mt-2 text-[0.95rem] text-slate-600">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Process */}
      <section id="process" className="border-y border-slate-200 bg-white py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-teal-700">The loop</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">Plan → Evaluate → Optimize</h2>
            <p className="mt-4 text-lg text-slate-600">A closed loop that turns every campaign into a sharper next decision.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-slate-200 bg-slate-50 p-7">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 font-mono text-sm font-bold text-white">{s.n}</div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{s.t}</h3>
                <p className="mt-2 text-[0.95rem] text-slate-600">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section id="why" className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid grid-cols-1 items-center gap-14 md:grid-cols-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-teal-700">Why commercial teams choose it</span>
            <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">Built for the way promotions actually get decided</h2>
            <p className="mt-4 text-slate-600">Spreadsheets can't tell you what was incremental, what to trust, or where the next budget should go. PromoLift can — transparently.</p>
            <div className="mt-7 flex flex-col gap-5">
              {[["No margin or P&L data needed", "Works entirely on revenue growth, incremental sales, uplift and investment efficiency — nothing sensitive to import."], ["Deterministic & auditable", "Every metric uses a fixed formula with full provenance and confidence. You can always see how a number was produced."], ["Secure & multi-tenant by design", "Row-level security isolates every organization. Roles control who can view, edit, approve and export."]].map(([t, d]) => (
                <div key={t} className="flex gap-4">
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-emerald-50 text-emerald-600"><Check /></span>
                  <div><h3 className="font-bold text-slate-900">{t}</h3><p className="mt-1 text-[0.95rem] text-slate-600">{d}</p></div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-8 shadow-sm">
            <div className="mb-1.5 text-xs uppercase tracking-[0.1em] text-slate-400">Campaign readout</div>
            <div className="mb-2 text-lg font-extrabold text-slate-900">Payday sale · Wipes 72s · Amazon</div>
            {[["Incremental revenue", "AED 24,000"], ["Net revenue ROI", "2.33×"], ["Revenue uplift", "50.0%"], ["Forecast accuracy", "92.9%"], ["Data-quality score", "100 / 100"]].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between border-b border-dashed border-slate-200 py-3.5 last:border-0">
                <span className="text-sm text-slate-500">{k}</span><span className="font-mono font-bold tabular-nums text-slate-900">{v}</span>
              </div>
            ))}
            <div className="flex items-baseline justify-between py-3.5">
              <span className="text-sm text-slate-500">Recommendation</span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Scale investment</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">Illustrative readout. Every figure is computed deterministically from your inputs.</p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-y border-slate-200 bg-white py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-teal-700">Pricing</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">Start free. Scale when it pays for itself.</h2>
            <p className="mt-4 text-lg text-slate-600">Every plan includes the deterministic engine, data-quality checks and explainable recommendations.</p>
          </div>
          <div className="mx-auto grid max-w-[440px] grid-cols-1 gap-5 md:max-w-none md:grid-cols-3">
            {PRICING.map((t) => (
              <div key={t.name} className={`relative flex flex-col rounded-2xl border bg-white p-8 shadow-sm ${t.featured ? "border-teal-600 shadow-xl" : "border-slate-200"}`}>
                {t.featured && <span className="absolute -top-3 left-7 rounded-full bg-teal-700 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-white">Most popular</span>}
                <div className="font-bold text-slate-900">{t.name}</div>
                <div className="mt-3.5"><span className="font-mono text-4xl font-extrabold tabular-nums text-slate-900">{t.price}</span><span className="font-mono text-sm text-slate-400">{t.per}</span></div>
                <p className="mt-1.5 min-h-[38px] text-sm text-slate-500">{t.desc}</p>
                <ul className="my-6 flex flex-col gap-2.5">
                  {t.feats.map((f) => <li key={f} className="flex items-start gap-2.5 text-[0.92rem] text-slate-700"><span className="mt-0.5 text-teal-700"><Check /></span>{f}</li>)}
                </ul>
                <Link to={t.name === "Enterprise" ? "/auth" : signupTo}
                  className={`mt-auto w-full rounded-xl px-5 py-3 text-center text-sm font-semibold ${t.featured ? "bg-teal-700 text-white hover:bg-teal-600" : "border border-slate-300 text-slate-800 hover:bg-slate-50"}`}>
                  {t.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-teal-700">FAQ</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">Questions, answered</h2>
        </div>
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {FAQ.map((f, i) => (
            <details key={i} open={i === 0} className="group rounded-xl border border-slate-200 bg-white px-5 open:border-teal-200">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="flex-none text-teal-700 transition group-open:rotate-45"><Ico d="M12 5v14 M5 12h14" className="h-4.5 w-4.5" /></span>
              </summary>
              <p className="pb-4 text-[0.95rem] text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 to-teal-800 px-8 py-16 text-center text-white shadow-2xl">
          <h2 className="text-3xl font-extrabold md:text-4xl">Stop guessing which promotions pay off.</h2>
          <p className="mx-auto mt-3 max-w-lg text-teal-50">Create your workspace in minutes and turn promotional spend into predictable revenue growth.</p>
          <Link to={signupTo} className="mt-8 inline-block rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-teal-800 hover:bg-teal-50">{primaryLabel}</Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500">
          <div className="flex items-center gap-2 font-extrabold text-slate-800">
            <span className="grid h-6 w-6 place-items-center rounded bg-gradient-to-br from-teal-600 to-teal-500 text-xs text-white">P</span>PromoLift
          </div>
          <p>Multi-Channel Growth &amp; Investment Planner</p>
          <div className="flex gap-6">
            <a href="#features" className="hover:text-slate-900">Platform</a>
            <a href="#pricing" className="hover:text-slate-900">Pricing</a>
            <a href="#faq" className="hover:text-slate-900">FAQ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
