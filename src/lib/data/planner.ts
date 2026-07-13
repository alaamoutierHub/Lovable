// PromoLift — promotion-plan persistence (TanStack Query + Supabase).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase/client";
import type { PromoMetrics } from "../calc/plan";
import type { Calc } from "../calc/types";
import type { DqResult } from "../dq/rules";
import type { PlannerDecision } from "../planner/decision";

const numOrNull = (c: Calc): number | null => (c.ok ? c.value : null);

/** Flatten the Calc-bearing metric bundle into a plain jsonb-friendly snapshot.
 *  `raw` carries the un-derived baseline/units so channel/SKU roll-ups can re-derive
 *  ratios from summed numerators/denominators (finding V9). Promo figures are
 *  reconstructed from baseline + incremental so they always reconcile. */
export function serializeCalc(
  metrics: PromoMetrics,
  decision: PlannerDecision,
  decisionReasons: string[],
  raw?: { baselineRevenue: number | null; baselineUnits: number | null },
): Record<string, unknown> {
  const incrRev = numOrNull(metrics.incrementalRevenue);
  const incrUnits = numOrNull(metrics.incrementalUnits);
  const baselineRevenue = raw?.baselineRevenue ?? null;
  const baselineUnits = raw?.baselineUnits ?? null;
  const promoRevenue = baselineRevenue != null && incrRev != null ? baselineRevenue + incrRev : null;
  const promoUnits = baselineUnits != null && incrUnits != null ? baselineUnits + incrUnits : null;
  return {
    baselineRevenue, baselineUnits, promoRevenue, promoUnits,
    baselineAsp: numOrNull(metrics.baselineAsp),
    promoAsp: numOrNull(metrics.promoAsp),
    incrementalRevenue: numOrNull(metrics.incrementalRevenue),
    revenueUpliftPct: numOrNull(metrics.revenueUpliftPct),
    incrementalUnits: numOrNull(metrics.incrementalUnits),
    unitUpliftPct: numOrNull(metrics.unitUpliftPct),
    aspChangePct: numOrNull(metrics.aspChangePct),
    aspDilutionPct: numOrNull(metrics.aspDilutionPct),
    totalInvestment: numOrNull(metrics.totalInvestment),
    investmentIntensity: numOrNull(metrics.investmentIntensity),
    revenueRoi: numOrNull(metrics.revenueRoi),
    incrementalRevenuePerAed: numOrNull(metrics.incrementalRevenuePerAed),
    costPerIncrementalUnit: numOrNull(metrics.costPerIncrementalUnit),
    breakEvenIncrementalRevenue: numOrNull(metrics.breakEvenIncrementalRevenue),
    breakEvenRevenueUpliftPct: numOrNull(metrics.breakEvenRevenueUpliftPct),
    minimumRequiredPromoSales: numOrNull(metrics.minimumRequiredPromoSales),
    forecastAccuracyDisplay: numOrNull(metrics.forecastAccuracyDisplay),
    targetAchievementPct: numOrNull(metrics.targetAchievementPct),
    notCalculable: metrics.notCalculable,
    decision,
    decisionReasons,
  };
}

export interface SavePlanArgs {
  id?: string;
  organizationId: string;
  fields: Record<string, unknown>; // column -> value for promotion_plans
  calc: Record<string, unknown>;
  dq: DqResult;
}

export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, organizationId, fields, calc, dq }: SavePlanArgs) => {
      if (!supabase) throw new Error("Supabase not connected");
      const payload = {
        ...fields,
        organization_id: organizationId,
        calc,
        dq_score: dq.score,
        dq_flags: dq.flags,
      };
      if (id) {
        const { error } = await supabase.from("promotion_plans").update(payload).eq("id", id);
        if (error) throw new Error(error.message);
        return id;
      }
      const { data, error } = await supabase
        .from("promotion_plans")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id as string;
    },
    onSuccess: (_id, vars) =>
      qc.invalidateQueries({ queryKey: ["plans", vars.organizationId] }),
  });
}

export function usePlanList(orgId: string | null) {
  return useQuery({
    queryKey: ["plans", orgId],
    enabled: Boolean(supabase && orgId),
    queryFn: async () => {
      if (!supabase || !orgId) return [];
      const { data, error } = await supabase
        .from("promotion_plans")
        .select("id, status, currency, calc, dq_score, notes, created_at")
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}
