// PromoLift — auth + active-organization context.
// Boots with or without Supabase configured (preview-safe).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../supabase/client";
import type { OrgRole } from "./permissions";

export interface Membership {
  organizationId: string;
  organizationName: string;
  role: OrgRole;
  allowedBrandIds: string[] | null;
  allowedChannelIds: string[] | null;
}

interface AuthState {
  loading: boolean;
  configured: boolean;
  user: User | null;
  session: Session | null;
  memberships: Membership[];
  activeOrgId: string | null;
  setActiveOrgId: (id: string) => void;
  role: OrgRole | null;
  activeMembership: Membership | null;
  signOut: () => Promise<void>;
  refreshMemberships: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  async function loadMemberships(userId: string) {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("organization_members")
      .select("organization_id, role, allowed_brand_ids, allowed_channel_ids, organizations(name)")
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (error) {
      console.error("[PromoLift] failed to load memberships", error.message);
      return;
    }
    const rows: Membership[] = (data ?? []).map((r: any) => ({
      organizationId: r.organization_id,
      organizationName: r.organizations?.name ?? "Organization",
      role: r.role as OrgRole,
      allowedBrandIds: r.allowed_brand_ids ?? null,
      allowedChannelIds: r.allowed_channel_ids ?? null,
    }));
    setMemberships(rows);
    setActiveOrgId((cur) => cur ?? rows[0]?.organizationId ?? null);
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadMemberships(data.session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) loadMemberships(s.user.id);
      else {
        setMemberships([]);
        setActiveOrgId(null);
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeMembership = useMemo(
    () => memberships.find((m) => m.organizationId === activeOrgId) ?? null,
    [memberships, activeOrgId],
  );

  const value: AuthState = {
    loading,
    configured: isSupabaseConfigured,
    user: session?.user ?? null,
    session,
    memberships,
    activeOrgId,
    setActiveOrgId,
    role: activeMembership?.role ?? null,
    activeMembership,
    signOut: async () => {
      if (supabase) await supabase.auth.signOut();
    },
    refreshMemberships: async () => {
      if (session?.user) await loadMemberships(session.user.id);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
