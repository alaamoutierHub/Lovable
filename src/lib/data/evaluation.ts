// PromoLift — post-promotion actuals persistence.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase/client";
import type { EvaluationResult } from "../evaluation/evaluate";

export function serializeEvaluation(r: EvaluationResult): Record<string, unknown> {
  const num = (c: { ok: boolean; value: unknown }) => (c.ok ? (c.value as number) : null);
  return {
    incrementalRevenue: num(r.actual.incrementalRevenue),
    revenueUpliftPct: num(r.actual.revenueUpliftPct),
    revenueRoi: num(r.actual.revenueRoi),
    incrementalRevenuePerAed: num(r.actual.incrementalRevenuePerAed),
    costPerIncrementalUnit: num(r.actual.costPerIncrementalUnit),
    totalInvestment: num(r.actual.totalInvestment),
    forecastVariance: num(r.actual.forecastVariance),
    forecastAccuracyDisplay: num(r.actual.forecastAccuracyDisplay),
    targetAchievementPct: num(r.actual.targetAchievementPct),
    variances: r.variances,
    outcome: r.outcome,
    outcomeReasons: r.outcomeReasons,
    supplyConstrained: r.supplyConstrained,
    notCalculable: r.actual.notCalculable,
  };
}

export interface SaveActualsArgs {
  organizationId: string;
  planId?: string | null;
  fields: Record<string, unknown>;
  calc: Record<string, unknown>;
  outcome: string;
}

export function useSaveActuals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ organizationId, planId, fields, calc, outcome }: SaveActualsArgs) => {
      if (!supabase) throw new Error("Supabase not connected");
      const { data, error } = await supabase
        .from("promotion_actuals")
        .insert({
          ...fields,
          organization_id: organizationId,
          plan_id: planId ?? null,
          calc,
          outcome_classification: outcome,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id as string;
    },
    onSuccess: (_id, vars) => qc.invalidateQueries({ queryKey: ["actuals", vars.organizationId] }),
  });
}

export function useActualsList(orgId: string | null) {
  return useQuery({
    queryKey: ["actuals", orgId],
    enabled: Boolean(supabase && orgId),
    queryFn: async () => {
      if (!supabase || !orgId) return [];
      const { data, error } = await supabase
        .from("promotion_actuals")
        .select("id, plan_id, outcome_classification, calc, created_at")
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}
