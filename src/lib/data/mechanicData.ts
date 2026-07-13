// PromoLift — fetch saved plans shaped for mechanic analysis.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase/client";
import type { MechanicPlanRow } from "../mechanic/aggregate";

export function useMechanicPlanRows(orgId: string | null) {
  return useQuery({
    queryKey: ["mechanic-rows", orgId],
    enabled: Boolean(supabase && orgId),
    queryFn: async (): Promise<MechanicPlanRow[]> => {
      if (!supabase || !orgId) return [];
      const { data, error } = await supabase
        .from("promotion_plans")
        .select("mechanic_id, channel_id, product_id, calc, promotion_mechanics(name), channels(name)")
        .eq("organization_id", orgId)
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: any): MechanicPlanRow => {
        const c = (r.calc ?? {}) as Record<string, number | null>;
        return {
          mechanicId: r.mechanic_id,
          mechanicName: r.promotion_mechanics?.name ?? "Unassigned",
          channelId: r.channel_id,
          channelName: r.channels?.name ?? "Unassigned",
          productId: r.product_id,
          baselineRevenue: c.baselineRevenue ?? null,
          promoRevenue: c.promoRevenue ?? null,
          baselineUnits: c.baselineUnits ?? null,
          promoUnits: c.promoUnits ?? null,
          totalInvestment: c.totalInvestment ?? null,
        };
      });
    },
  });
}
