// Commerly — fetch saved plans for the History module (all joins).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase/client";
import type { HistoryRow } from "../history/history";

export function useHistory(orgId: string | null) {
  return useQuery({
    queryKey: ["history", orgId],
    enabled: Boolean(supabase && orgId),
    queryFn: async (): Promise<HistoryRow[]> => {
      if (!supabase || !orgId) return [];
      const { data, error } = await supabase
        .from("promotion_plans")
        .select("id, start_date, end_date, status, notes, calc, created_at, channel_id, product_id, mechanic_id, channels(name), brands(name), products(name), promotion_mechanics(name)")
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: any): HistoryRow => {
        const c = (r.calc ?? {}) as Record<string, unknown>;
        return {
          id: r.id,
          channelId: r.channel_id, channelName: r.channels?.name ?? "—",
          brandName: r.brands?.name ?? "—",
          productId: r.product_id, productName: r.products?.name ?? "—",
          mechanicId: r.mechanic_id, mechanicName: r.promotion_mechanics?.name ?? "—",
          startDate: r.start_date, endDate: r.end_date, status: r.status,
          decision: (c.decision as string) ?? null,
          roi: typeof c.revenueRoi === "number" ? (c.revenueRoi as number) : null,
          dqScore: null, // dq_score column not selected here; kept for parity
          notes: r.notes, createdAt: r.created_at,
        };
      });
    },
  });
}
