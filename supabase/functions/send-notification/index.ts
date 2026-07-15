// Commerly — Email Notification Edge Function (Supabase / Deno) via Resend.
// Sends transactional email (report delivery, approval notifications). The API key
// stays server-side. Callers must be authenticated (Supabase verifies the JWT).
//
// Secret (set as an Edge Function secret, NOT in the frontend):
//   RESEND_API_KEY   (required)
//   RESEND_FROM      (optional, default "Commerly <onboarding@resend.dev>")

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "Commerly <onboarding@resend.dev>";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });
}

const isEmail = (s: unknown): s is string => typeof s === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!RESEND_API_KEY) return json({ error: "Email is not configured (RESEND_API_KEY not set)." }, 503);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const { to, subject, text } = payload ?? {};
  if (!isEmail(to)) return json({ error: "Valid 'to' email is required." }, 400);
  if (!subject || typeof subject !== "string") return json({ error: "'subject' is required." }, 400);
  if (!text || typeof text !== "string") return json({ error: "'text' body is required." }, 400);

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, text }),
    });
  } catch (e) {
    return json({ error: "Failed to reach Resend: " + String(e) }, 502);
  }

  if (!res.ok) return json({ error: "Resend error", status: res.status, detail: await res.text() }, 502);
  const result = await res.json();
  return json({ sent: true, id: result?.id ?? null });
});
