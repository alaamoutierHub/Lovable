// Commerly — one query powering the whole Executive Overview dashboard:
// per-plan raw figures (for channel roll-ups), plus dates, status, DQ score and
// derived ROI/incremental so the page can build every chart from a single fetch.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase/client";
import type { PlanRow } from "../channel/aggregate";

export interface DashboardRow extends PlanRow {
  startDate: string | null;
  status: string;
  dqScore: number | null;
  incrementalRevenue: number | null;
  revenueRoi: number | null;
}

export function useDashboardRows(orgId: string | null) {
  return useQuery({
    queryKey: ["dashboard-rows", orgId],
    enabled: Boolean(supabase && orgId),
    queryFn: async (): Promise<DashboardRow[]> => {
      if (!supabase || !orgId) return [];
      const { data, error } = await supabase
        .from("promotion_plans")
        .select("channel_id, product_id, start_date, status, dq_score, calc, channels(name)")
        .eq("organization_id", orgId)
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: any): DashboardRow => {
        const c = (r.calc ?? {}) as Record<string, number | null>;
        return {
          channelId: r.channel_id,
          channelName: r.channels?.name ?? "Unassigned",
          productId: r.product_id,
          baselineRevenue: c.baselineRevenue ?? null,
          promoRevenue: c.promoRevenue ?? null,
          baselineUnits: c.baselineUnits ?? null,
          promoUnits: c.promoUnits ?? null,
          totalInvestment: c.totalInvestment ?? null,
          startDate: r.start_date ?? null,
          status: r.status ?? "draft",
          dqScore: r.dq_score ?? null,
          incrementalRevenue: c.incrementalRevenue ?? null,
          revenueRoi: c.revenueRoi ?? null,
        };
      });
    },
  });
}
