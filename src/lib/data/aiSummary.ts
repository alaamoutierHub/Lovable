// Commerly — client hook for the AI summary Edge Function.
// Sends already-computed data; the function calls Anthropic server-side and returns
// a strict-schema narrative. No API keys touch the browser.
import { useMutation } from "@tanstack/react-query";
import { supabase } from "../supabase/client";

export interface AiSummaryOutput {
  executiveSummary: string;
  keyFindings: string[];
  strongestOpportunities: string[];
  weakestInvestments: string[];
  recommendedBudgetShifts: string[];
  risks: string[];
  recommendedActions: string[];
  expectedDirectionalImpact: string;
  dataLimitations: string[];
  confidenceLevel: "high" | "medium" | "low";
}

export function useAiSummary() {
  return useMutation({
    mutationFn: async ({ data, organizationId }: { data: unknown; organizationId: string }): Promise<AiSummaryOutput> => {
      if (!supabase) throw new Error("Supabase not connected");
      const { data: res, error } = await supabase.functions.invoke("ai-summary", {
        body: { data, organizationId },
      });
      if (error) {
        // Surface the function's own error message when available (e.g. AI not configured).
        const detail = (res as { error?: string })?.error;
        throw new Error(detail || error.message);
      }
      if ((res as { error?: string })?.error) throw new Error((res as { error: string }).error);
      return (res as { summary: AiSummaryOutput }).summary;
    },
  });
}
