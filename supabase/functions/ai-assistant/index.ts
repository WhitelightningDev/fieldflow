import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return jsonResponse({ error: "Missing auth header" }, 401);
    }

    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const anonKey = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
    if (!supabaseUrl || !anonKey) {
      return jsonResponse({ error: "Missing Supabase env vars" }, 500);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader, apikey: anonKey } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await callerClient.auth.getUser(token);
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Check profile → company
    const { data: profile } = await callerClient
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const companyId = (profile as any)?.company_id as string | null;
    if (!companyId) {
      return jsonResponse({ error: "No company linked to this account" }, 403);
    }

    // Check Business plan
    const { data: company } = await callerClient
      .from("companies")
      .select("subscription_tier")
      .eq("id", companyId)
      .maybeSingle();
    const tier = String((company as any)?.subscription_tier ?? "starter").toLowerCase();
    if (tier !== "business") {
      return jsonResponse({ error: "Business plan required for AI Assistant" }, 403);
    }

    // Check allowed roles
    const { data: roleRows } = await callerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const allowedRoles = new Set(["owner", "admin", "office_staff"]);
    const canUse = (Array.isArray(roleRows) ? roleRows : []).some((row: any) =>
      allowedRoles.has(String(row?.role ?? ""))
    );
    if (!canUse) {
      return jsonResponse({ error: "Insufficient permissions for AI Assistant" }, 403);
    }

    // Parse body
    let rawBody: any = null;
    try {
      const text = await req.text();
      rawBody = text ? JSON.parse(text) : null;
    } catch {
      rawBody = null;
    }

    const message = (typeof rawBody?.message === "string" ? rawBody.message : "").trim();
    const context = (typeof rawBody?.context === "string" ? rawBody.context : "").trim();

    if (!message) {
      return jsonResponse({ error: "Missing message" }, 400);
    }

    // Use Lovable AI Gateway
    const LOVABLE_API_KEY = (Deno.env.get("LOVABLE_API_KEY") ?? "").trim();
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "AI is not configured (missing LOVABLE_API_KEY)" }, 501);
    }

    const systemPrompt =
      "You are FieldFlow AI, an assistant inside an admin dashboard for a field-service business. " +
      "Be concise, practical, and action-oriented. If context is missing, ask one short clarifying question.";

    const userContent = context
      ? `User request:\n${message}\n\nDashboard context (may be partial):\n${context}`
      : message;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return jsonResponse({ error: "Rate limit exceeded, please try again later." }, 429);
      }
      if (aiResponse.status === 402) {
        return jsonResponse({ error: "AI credits depleted. Please add credits to continue." }, 402);
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return jsonResponse({ error: "AI gateway error" }, 502);
    }

    const aiData: any = await aiResponse.json();
    const text = aiData?.choices?.[0]?.message?.content ?? "";

    if (!text.trim()) {
      return jsonResponse({ error: "AI returned no text output." }, 502);
    }

    return jsonResponse({ text: text.trim() }, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("ai-assistant error:", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
