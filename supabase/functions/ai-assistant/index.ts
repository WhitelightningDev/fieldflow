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

const ALLOWED_ORIGINS = new Set([
  "https://fieldflow-billing.vercel.app",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://[::1]:8000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const CORS_ALLOW_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
].join(", ");

function corsForRequest(req: Request): { allowed: boolean; headers: Record<string, string> } {
  const origin = req.headers.get("Origin");
  const hasOrigin = typeof origin === "string" && origin.length > 0;

  if (hasOrigin && !ALLOWED_ORIGINS.has(origin)) {
    return { allowed: false, headers: { Vary: "Origin" } };
  }

  const allowOrigin = hasOrigin ? origin : "*";
  return {
    allowed: true,
    headers: {
      Vary: "Origin",
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
    },
  };
}

function jsonResponse(body: unknown, init: { status: number; headers: Record<string, string> }) {
  return new Response(JSON.stringify(body), {
    status: init.status,
    headers: { ...init.headers, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const cors = corsForRequest(req);
  if (!cors.allowed) {
    if (req.method === "OPTIONS") return new Response(null, { status: 403, headers: cors.headers });
    return jsonResponse({ error: "Origin not allowed" }, { status: 403, headers: cors.headers });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors.headers });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return jsonResponse({ error: "Missing auth header" }, { status: 401, headers: cors.headers });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");

    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const anonKey = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
    if (!supabaseUrl || !anonKey) {
      const missing: string[] = [];
      if (!supabaseUrl) missing.push("SUPABASE_URL");
      if (!anonKey) missing.push("SUPABASE_ANON_KEY");
      return jsonResponse(
        {
          error: `Missing Supabase function env vars: ${missing.join(", ")}`,
          hint: "Set via `supabase secrets set`, then redeploy the function.",
        },
        { status: 500, headers: cors.headers },
      );
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader, apikey: anonKey } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await callerClient.auth.getUser(token);
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, { status: 401, headers: cors.headers });
    }

    // Enforce plan tier (Business only) and allowed roles (owner/admin/office_staff).
    const { data: profile, error: profileErr } = await callerClient
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileErr) {
      return jsonResponse({ error: profileErr.message ?? "Failed to load profile" }, { status: 500, headers: cors.headers });
    }
    const companyId = (profile as any)?.company_id as string | null | undefined;
    if (!companyId) {
      return jsonResponse({ error: "No company linked to this account" }, { status: 403, headers: cors.headers });
    }

    const { data: company, error: companyErr } = await callerClient
      .from("companies")
      .select("subscription_tier")
      .eq("id", companyId)
      .maybeSingle();
    if (companyErr) {
      return jsonResponse({ error: companyErr.message ?? "Failed to load company" }, { status: 500, headers: cors.headers });
    }
    const tier = String((company as any)?.subscription_tier ?? "starter").toLowerCase();
    if (tier !== "business") {
      return jsonResponse({ error: "Business plan required for AI Assistant" }, { status: 403, headers: cors.headers });
    }

    const { data: roleRows, error: rolesErr } = await callerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (rolesErr) {
      return jsonResponse({ error: rolesErr.message ?? "Failed to load roles" }, { status: 500, headers: cors.headers });
    }
    const allowedRoles = new Set(["owner", "admin", "office_staff"]);
    const canUseAi = (Array.isArray(roleRows) ? roleRows : []).some((row) => {
      if (!isRecord(row)) return false;
      return allowedRoles.has(String(row["role"] ?? ""));
    });
    if (!canUseAi) {
      return jsonResponse({ error: "Insufficient permissions for AI Assistant" }, { status: 403, headers: cors.headers });
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
      return jsonResponse({ error: "Missing message" }, { status: 400, headers: cors.headers });
    }

    const openaiKey = (Deno.env.get("OPENAI_API_KEY") ?? "").trim();
    if (!openaiKey) {
      return jsonResponse(
        {
          error: "AI is not configured yet.",
          hint: "Set OPENAI_API_KEY (and optionally OPENAI_MODEL) via `supabase secrets set`, then redeploy this function.",
        },
        { status: 501, headers: cors.headers },
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
      return jsonResponse({ error: msg }, { status: 502, headers: cors.headers });
    }

    const text = extractOutputText(payload);
    if (!text) {
      return jsonResponse({ error: "AI returned no text output." }, { status: 502, headers: cors.headers });
    }

    return jsonResponse({ text }, { status: 200, headers: cors.headers });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ error: msg }, { status: 500, headers: cors.headers });
  }
});
