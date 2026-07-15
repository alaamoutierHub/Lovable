// Commerly — rich per-plan feed for the Analytics dashboard: names for channel,
// SKU and mechanic, the raw investment split, dates/status, and the derived
// metrics — everything the BI charts need from a single query.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase/client";

export interface AnalyticsRow {
  startDate: string | null;
  status: string;
  dqScore: number | null;
  channelId: string | null;
  channelName: string;
  productName: string;
  mechanicName: string;
  baselineRevenue: number | null;
  promoRevenue: number | null;
  totalInvestment: number | null;
  incrementalRevenue: number | null;
  revenueRoi: number | null;
  revenueUpliftPct: number | null;
  mediaSpend: number;
  tradeSupport: number;
  visibilityFees: number;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function useAnalyticsRows(orgId: string | null) {
  return useQuery({
    queryKey: ["analytics-rows", orgId],
    enabled: Boolean(supabase && orgId),
    queryFn: async (): Promise<AnalyticsRow[]> => {
      if (!supabase || !orgId) return [];
      const { data, error } = await supabase
        .from("promotion_plans")
        .select("start_date, status, dq_score, channel_id, calc, media_spend, trade_support, visibility_fees, channels(name), products(name), promotion_mechanics(name)")
        .eq("organization_id", orgId)
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: any): AnalyticsRow => {
        const c = (r.calc ?? {}) as Record<string, number | null>;
        return {
          startDate: r.start_date ?? null,
          status: r.status ?? "draft",
          dqScore: r.dq_score ?? null,
          channelId: r.channel_id,
          channelName: r.channels?.name ?? "Unassigned",
          productName: r.products?.name ?? "Unassigned",
          mechanicName: r.promotion_mechanics?.name ?? "Unassigned",
          baselineRevenue: c.baselineRevenue ?? null,
          promoRevenue: c.promoRevenue ?? null,
          totalInvestment: c.totalInvestment ?? null,
          incrementalRevenue: c.incrementalRevenue ?? null,
          revenueRoi: c.revenueRoi ?? null,
          revenueUpliftPct: c.revenueUpliftPct ?? null,
          mediaSpend: num(r.media_spend),
          tradeSupport: num(r.trade_support),
          visibilityFees: num(r.visibility_fees),
        };
      });
    },
  });
}
