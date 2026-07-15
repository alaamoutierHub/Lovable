// Commerly — fetch saved plans shaped for the SKU-Channel matrix.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase/client";
import type { MatrixPlanRow } from "../matrix/matrix";

export function useMatrixPlanRows(orgId: string | null) {
  return useQuery({
    queryKey: ["matrix-rows", orgId],
    enabled: Boolean(supabase && orgId),
    queryFn: async (): Promise<MatrixPlanRow[]> => {
      if (!supabase || !orgId) return [];
      const { data, error } = await supabase
        .from("promotion_plans")
        .select("channel_id, product_id, calc, channels(name), products(name)")
        .eq("organization_id", orgId)
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: any): MatrixPlanRow => {
        const c = (r.calc ?? {}) as Record<string, number | null>;
        return {
          channelId: r.channel_id,
          channelName: r.channels?.name ?? "Unassigned",
          productId: r.product_id,
          productName: r.products?.name ?? "Unassigned SKU",
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
