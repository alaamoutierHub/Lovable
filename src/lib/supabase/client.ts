// PromoLift — Supabase browser client.
// Uses the anon key (RLS-gated). NEVER import service-role or provider API keys here.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Non-fatal in dev/preview so the app still boots before Supabase is wired.
  console.warn(
    "[PromoLift] Supabase env not set. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY " +
      "(see .env.example). Auth/data features are disabled until then.",
  );
}

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

export const isSupabaseConfigured = Boolean(url && anonKey);
