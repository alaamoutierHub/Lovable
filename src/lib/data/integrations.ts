// Commerly — integrations connection state (RLS: admin-only writes).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase/client";

export interface IntegrationRow {
  provider: string;
  status: "disconnected" | "connected" | "error";
  config: Record<string, unknown> | null;
  last_error: string | null;
  connected_at: string | null;
}

export function useIntegrations(orgId: string | null) {
  return useQuery({
    queryKey: ["integrations", orgId],
    enabled: Boolean(supabase && orgId),
    queryFn: async (): Promise<Record<string, IntegrationRow>> => {
      if (!supabase || !orgId) return {};
      const { data, error } = await supabase
        .from("integrations")
        .select("provider, status, config, last_error, connected_at")
        .eq("organization_id", orgId);
      if (error) throw new Error(error.message);
      return Object.fromEntries((data ?? []).map((r: any) => [r.provider, r as IntegrationRow]));
    },
  });
}

export function useConnectIntegration(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ provider, config }: { provider: string; config: Record<string, unknown> }) => {
      if (!supabase || !orgId) throw new Error("Supabase not connected");
      const { error } = await supabase.from("integrations").upsert(
        {
          organization_id: orgId, provider, status: "connected",
          config, last_error: null, connected_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,provider" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations", orgId] }),
  });
}

export function useDisconnectIntegration(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (provider: string) => {
      if (!supabase || !orgId) throw new Error("Supabase not connected");
      const { error } = await supabase.from("integrations").upsert(
        { organization_id: orgId, provider, status: "disconnected", connected_at: null },
        { onConflict: "organization_id,provider" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations", orgId] }),
  });
}
