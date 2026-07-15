# Deploying Commerly (shareable link with working signup)

> ⚠️ The `*.lovable.app` URL from a Lovable *project* is Lovable's own generated app,
> **not** this repo. To share the real Commerly app, deploy **this repo** with the
> Supabase env vars. Two options below — Vercel/Netlify is fastest and most reliable.

## What the deployed build needs
Vite inlines these at **build time**, so they must be set in the host's env:

| Var | Value (Supabase → Project Settings → API) |
|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the publishable / anon key (`sb_publishable_…` / `eyJ…`) |

Optional: `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_SENTRY_DSN`.

## Option A — Vercel (recommended)
1. [vercel.com](https://vercel.com) → **New Project** → import `alaamoutierHub/Lovable`.
2. It auto-detects Vite. `vercel.json` in the repo already sets build (`npm run build`),
   output (`dist`), and the SPA rewrite (so `/planner`, `/auth`, etc. don't 404 on refresh).
3. **Environment Variables** → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. **Deploy** → you get `https://<name>.vercel.app`. Signup/login work exactly like localhost.

## Option B — Netlify
1. [netlify.com](https://netlify.com) → **Add new site → Import** `alaamoutierHub/Lovable`.
2. Build command `npm run build`, publish directory `dist` (SPA redirect handled by `public/_redirects`).
3. **Site settings → Environment variables** → add the two `VITE_SUPABASE_*` vars.
4. Deploy → public URL.

## Option C — Keep it in Lovable
Point your Lovable project at **this repo** (Lovable → GitHub → connect the existing
`alaamoutierHub/Lovable` repo, enable two-way sync) so Lovable builds *this* code instead of
its generated starter. Ensure Lovable's build env has the two `VITE_SUPABASE_*` vars. Lovable's
own generated files may need reconciling with the repo — align on this repo's structure.

## After deploying — one Supabase setting
Supabase → **Authentication → URL Configuration**:
- Set **Site URL** to your deployed URL.
- Add the deployed URL to **Redirect URLs** (needed for password-reset / email links).

## Signup UX reminder
Email confirmation is **ON**. New users must click the email link before logging in. For an
open demo, turn it **OFF** (Authentication → Providers → Email → Confirm email) so people log in
immediately. Each new user gets their own isolated organization (RLS-enforced).
