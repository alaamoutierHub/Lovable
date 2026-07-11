# Connecting this repo to Lovable + Supabase

We chose the **Lovable-first** path: Lovable owns the initial scaffold, and this repo's
backend/logic syncs in through GitHub. There is no Lovable API — GitHub two-way sync is the bridge.

## Step-by-step

1. **Create the project in Lovable** using its default stack (Vite + React + TS + Tailwind +
   shadcn/ui). Give it a first prompt so it generates a working shell.
2. In Lovable, **connect GitHub** and let it create a **new private repo** (or push to one you create).
   Enable **two-way sync**.
3. **Connect Supabase inside Lovable** (Lovable → Supabase native integration). This provisions the
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` for the app automatically.
4. **Share the GitHub repo URL here.** I will then:
   - add it as a git remote and **rebase this repo's durable work onto Lovable's scaffold**:
     - `supabase/migrations/*` (schema + RLS)  ← runs on your Supabase project
     - `src/lib/calc/*` (deterministic engine + tests)
     - `src/lib/auth/*` (RBAC model + tests)
     - `src/lib/schemas/*` (Zod validation)
     - `src/lib/supabase/client.ts`
     - `docs/*`
   - resolve any scaffold-file overlaps in **Lovable's favor** (its `package.json`, `App.tsx`,
     Tailwind/shadcn config win; my placeholder versions drop out).
5. **Run the migrations** on Supabase (via Lovable's SQL editor or the Supabase dashboard), then verify
   RLS with the cross-tenant tests before loading real data.

## Secrets — do NOT paste these into the frontend or Lovable chat
Set these as **Supabase Edge Function secrets / Vault**, never as `VITE_` vars:
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`.
Only the anon key belongs in the client (it is RLS-gated).

## Working rule once synced
Two editors on one repo → **pull before you edit**. When you generate UI in Lovable, let it push; before
I add backend work I pull first. This avoids merge conflicts.
