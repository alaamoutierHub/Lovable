// PromoLift — Supabase browser client.
// Uses the anon/publishable key (RLS-gated). NEVER import service-role or provider
// API keys here.
import { createClient } from "@supabase/supabase-js";

// Public, RLS-gated connection values — safe to ship in the client (the anon key
// is designed to be public; row-level security enforces access, not key secrecy).
// Env vars override these, so a different deployment can target a different project;
// the hardcoded fallback means the app connects on ANY host (Lovable, Vercel,
// localhost) with no build-time env configuration required.
const FALLBACK_URL = "https://saqxzeldpwjawvvmxikz.supabase.co";
const FALLBACK_ANON_KEY = "sb_publishable_GoOamU1wdwgquV_aCcfynQ_-bqoRtI8";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_URL;
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_ANON_KEY;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const isSupabaseConfigured = Boolean(url && anonKey);
