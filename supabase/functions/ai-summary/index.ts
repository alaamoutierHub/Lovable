// Commerly — AI Summary Edge Function (Supabase / Deno).
// Server-side proxy to Anthropic. Receives ALREADY-COMPUTED metrics + recommendations
// and returns a strict-JSON-schema narrative. The API key never leaves the server, and
// the model is instructed never to compute or invent numbers — only to explain them.
//
// Secrets (set as Edge Function secrets, NOT in the frontend):
//   ANTHROPIC_API_KEY   (required)
//   ANTHROPIC_MODEL     (optional, default claude-opus-4-8)
// SUPABASE_URL / SUPABASE_ANON_KEY are injected automatically by Supabase.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-opus-4-8";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Strict output schema — the model is constrained to exactly this shape (docs §8).
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    executiveSummary: { type: "string" },
    keyFindings: { type: "array", items: { type: "string" } },
    strongestOpportunities: { type: "array", items: { type: "string" } },
    weakestInvestments: { type: "array", items: { type: "string" } },
    recommendedBudgetShifts: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    recommendedActions: { type: "array", items: { type: "string" } },
    expectedDirectionalImpact: { type: "string" },
    dataLimitations: { type: "array", items: { type: "string" } },
    confidenceLevel: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: [
    "executiveSummary", "keyFindings", "strongestOpportunities", "weakestInvestments",
    "recommendedBudgetShifts", "risks", "recommendedActions", "expectedDirectionalImpact",
    "dataLimitations", "confidenceLevel",
  ],
};

const SYSTEM =
  "You are a commercial analytics assistant for Commerly, a promotional-investment decision-support " +
  "platform. You receive ALREADY-COMPUTED metrics, recommendations and budget shifts as JSON. " +
  "You MUST NOT compute, estimate, or invent any numbers — only explain, summarize, prioritize and " +
  "narrate what is given. Every statement must be grounded in the provided data. Never present " +
  "recommendations as guaranteed outcomes; frame impact as directional. If the data is thin or " +
  "low-confidence, say so in dataLimitations and lower confidenceLevel. Respond ONLY with the required JSON.";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: "AI is not configured (ANTHROPIC_API_KEY not set)." }, 503);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const data = payload?.data ?? payload;
  if (!data) return json({ error: "Missing computed data" }, 400);

  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{
      role: "user",
      content: "Computed decision-support data (JSON). Produce the management summary:\n\n" + JSON.stringify(data),
    }],
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA }, effort: "medium" },
  };

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return json({ error: "Failed to reach Anthropic: " + String(e) }, 502);
  }

  if (!res.ok) {
    return json({ error: "Anthropic error", status: res.status, detail: await res.text() }, 502);
  }

  const result = await res.json();
  if (result.stop_reason === "refusal") return json({ error: "The model declined this request." }, 422);

  const textBlock = (result.content ?? []).find((b: any) => b.type === "text");
  let parsed: unknown;
  try { parsed = JSON.parse(textBlock?.text ?? "{}"); }
  catch { return json({ error: "Model returned non-JSON output.", raw: textBlock?.text }, 502); }

  // Best-effort audit write, RLS-enforced via the CALLER's JWT (never service role):
  // a spoofed organizationId is rejected by row-level security, not trusted here.
  try {
    const authHeader = req.headers.get("Authorization");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const orgId = payload?.organizationId;
    if (authHeader && anonKey && supabaseUrl && orgId) {
      await fetch(`${supabaseUrl}/rest/v1/ai_summaries`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          authorization: authHeader,
          "content-type": "application/json",
          prefer: "return=minimal",
        },
        body: JSON.stringify({
          organization_id: orgId, scope: "management_summary",
          input_payload: data, output: parsed, model: ANTHROPIC_MODEL, prompt_version: "v1",
        }),
      });
    }
  } catch { /* non-fatal: audit write must not break the response */ }

  return json({ summary: parsed, model: ANTHROPIC_MODEL });
});
