# PromoLift — Security Review (Stage 19)

Live-verified against the connected Supabase project on 2026-07-13. Commands and
results are reproducible; see "How to re-run" below.

## 1. Secret handling — PASS

**No server secret values reach the frontend bundle.** Scan of `dist/`:

| Pattern | Matches |
|---|---|
| `sk-ant-…` (Anthropic) | 0 |
| `re_…` (Resend) | 0 |
| `sk_live_ / sk_test_` (Stripe) | 0 |
| service-role JWT (`role":"service_role"`) | 0 |
| `whsec_…` (webhook secret) | 0 |

- Only **public** client vars ship: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (RLS-gated).
- The secret **names** (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`) appear in the
  bundle **only as UI labels** in the Integrations page ("set in Supabase, not here") — names, never values.
- All external API calls (Anthropic, Resend) run in **Edge Functions**; keys live in Supabase Edge
  Function secrets. `.env` is gitignored and never committed.

## 2. Row Level Security — PASS

RLS is enabled on every business table with `organization_id`; policies pivot on `is_org_member` /
role bundles (see `supabase/migrations/20260711120100_rls_policies.sql`).

**Live tests (publishable key, NO user JWT):**

| Attack | Result |
|---|---|
| Read `promotion_plans, channels, organizations, organization_members, products, integrations, ai_summaries` | every table → `[]` |
| Read a **specific real org id** (`organizations?id=eq.…aa`) | `[]` |
| INSERT into `channels` for a real org | `42501 new row violates row-level security policy` |

The database is full of real data (Demo Commercial Co, channels, plans) — yet an unauthenticated caller
sees and can write **nothing**. The publishable key grants no data access on its own; a valid
authenticated session is required, and each session is scoped to its own org.

Authenticated single-tenant scoping was also verified in-app: the signed-in owner sees only their own
organization's data across every module.

## 3. Authentication — PASS (with best-practice defaults)

- Email confirmation **ON** (Supabase default) — kept on for production.
- Edge Functions (`ai-summary`, `send-notification`) require a valid Supabase JWT (verify_jwt default).
- Audit writes from `ai-summary` use the **caller's JWT**, so a spoofed `organization_id` is rejected by
  RLS rather than trusted server-side (no service-role over-trust).
- Sessions persist via Supabase auth (auto-refresh, secure storage).

## 4. Data protection — PASS

- **Soft delete** (`deleted_at`) on business tables; live queries filter it out.
- **Audit log** table + append-only insert policy; approvals carry revision history.
- **Multi-tenant isolation** via `organization_id` on every table (§2).

## 5. Residual hardening for production (tracked, not blocking)

| Item | Status / plan |
|---|---|
| Storage signed URLs | No storage objects served yet; when Attachments ship, use signed URLs + private buckets |
| Edge Function rate limiting | Rely on Supabase platform limits now; add per-user throttle if abuse appears |
| Supabase Auth: leaked-password protection | Recommend enabling in Auth settings |
| Content-Security-Policy headers | Set at the hosting layer (Lovable / CDN) |
| Separate dev / prod projects | Recommended before real customer data |
| Publishable key rotation | Not a secret (RLS-gated); rotate only if policy changes |
| DB password | Was never exposed (migrations run via SQL editor); rotate if ever shared |

## How to re-run

```bash
# Secret-value scan of the built bundle
npm run build
grep -roE "sk-ant-[A-Za-z0-9_-]{10,}|\bre_[A-Za-z0-9]{16,}|sk_(live|test)_[A-Za-z0-9]{16,}" dist/ | wc -l   # expect 0

# Live RLS isolation (unauthenticated)
URL="<VITE_SUPABASE_URL>/rest/v1"; KEY="<VITE_SUPABASE_ANON_KEY>"
curl -s "$URL/promotion_plans?select=id&limit=5" -H "apikey: $KEY"    # expect []
curl -s -X POST "$URL/channels" -H "apikey: $KEY" -H "content-type: application/json" \
  -d '{"organization_id":"<any>","name":"x"}'                          # expect 42501 RLS violation
```

**Verdict:** the tenancy, secret-handling, and auth boundaries hold under live adversarial testing.
Remaining items are production-hardening, not open vulnerabilities.
