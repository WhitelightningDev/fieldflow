import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapPayload(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  const body = raw["body"];
  if (isRecord(body)) return body;
  const data = raw["data"];
  if (isRecord(data)) return data;
  return raw;
}

function getOptionalString(obj: Record<string, unknown>, key: string) {
  const v = obj[key];
  return typeof v === "string" ? v : null;
}

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function readErrorMessage(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const err = payload["error"];
  if (typeof err === "string") return err;
  if (isRecord(err) && typeof err["message"] === "string") return String(err["message"]);
  return null;
}

function extractOutputText(payload: unknown): string {
  if (!isRecord(payload)) return "";

  const direct = payload["output_text"];
  if (typeof direct === "string" && direct.trim()) return direct;

  const output = payload["output"];
  if (!Array.isArray(output)) return "";

  const parts: string[] = [];
  for (const item of output) {
    if (!isRecord(item)) continue;
    if (item["type"] !== "message") continue;
    const content = item["content"];
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (!isRecord(c)) continue;
      if (c["type"] === "output_text" && typeof c["text"] === "string") {
        parts.push(String(c["text"]));
      }
    }
  }
  return parts.join("\n").trim();
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");

    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
    if (!supabaseUrl || !serviceRoleKey) {
      const missing: string[] = [];
      if (!supabaseUrl) missing.push("SUPABASE_URL");
      if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({
          error: `Missing Supabase function env vars: ${missing.join(", ")}`,
          hint: "Set SUPABASE_SERVICE_ROLE_KEY via `supabase secrets set` and redeploy the function.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await callerClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let rawBody: unknown = null;
    try {
      const text = await req.text();
      rawBody = text ? JSON.parse(text) : null;
    } catch {
      rawBody = null;
    }

    const body = unwrapPayload(rawBody);
    const message = (getOptionalString(body, "message") ?? "").trim();
    const context = (getOptionalString(body, "context") ?? "").trim();

    if (!message) {
      return new Response(JSON.stringify({ error: "Missing message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiKey = (Deno.env.get("OPENAI_API_KEY") ?? "").trim();
    if (!openaiKey) {
      return new Response(
        JSON.stringify({
          error: "AI is not configured yet.",
          hint: "Set OPENAI_API_KEY (and optionally OPENAI_MODEL) via `supabase secrets set`, then redeploy this function.",
        }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const openaiBaseUrl = (Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").trim();
    const openaiModel = (Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini").trim();

    const instructions =
      "You are FieldFlow AI, an assistant inside an admin dashboard for a field-service business. " +
      "Be concise, practical, and action-oriented. If context is missing, ask one short clarifying question.";

    const input = context
      ? `User request:\n${message}\n\nDashboard context (may be partial):\n${context}`
      : message;

    const res = await fetch(joinUrl(openaiBaseUrl, "/responses"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openaiModel,
        instructions,
        input,
      }),
    });

    const payload: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = readErrorMessage(payload) ?? res.statusText ?? "OpenAI request failed";
      return new Response(JSON.stringify({ error: msg }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = extractOutputText(payload);
    if (!text) {
      return new Response(JSON.stringify({ error: "AI returned no text output." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
