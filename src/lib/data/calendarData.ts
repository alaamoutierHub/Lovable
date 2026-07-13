// PromoLift — fetch saved plans shaped for the promotion calendar.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase/client";
import type { CalPlan } from "../calendar/calendar";

export function useCalendarPlans(orgId: string | null) {
  return useQuery({
    queryKey: ["calendar-plans", orgId],
    enabled: Boolean(supabase && orgId),
    queryFn: async (): Promise<CalPlan[]> => {
      if (!supabase || !orgId) return [];
      const { data, error } = await supabase
        .from("promotion_plans")
        .select("id, start_date, end_date, status, notes, calc, channel_id, product_id, channels(name), products(name)")
        .eq("organization_id", orgId)
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: any): CalPlan => {
        const c = (r.calc ?? {}) as Record<string, number | null>;
        const sku = r.products?.name ?? "SKU";
        const ch = r.channels?.name ?? "Channel";
        return {
          id: r.id,
          label: r.notes || `${sku} · ${ch}`,
          channelId: r.channel_id,
          productId: r.product_id,
          startDate: r.start_date,
          endDate: r.end_date,
          status: r.status,
          totalInvestment: c.totalInvestment ?? null,
        };
      });
    },
  });
}
