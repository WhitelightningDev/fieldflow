import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("getClaims error:", claimsError?.message ?? "no claims");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;
    if (!userId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Check profile → company
    const { data: profile } = await callerClient
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
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
      .eq("user_id", userId);
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

    const mode = (typeof rawBody?.mode === "string" ? rawBody.mode : "chat").trim();
    const message = (typeof rawBody?.message === "string" ? rawBody.message : "").trim();
    const context = (typeof rawBody?.context === "string" ? rawBody.context : "").trim();

    if (mode === "chat" && !message) {
      return jsonResponse({ error: "Missing message" }, 400);
    }

    // Use Lovable AI Gateway
    const LOVABLE_API_KEY = (Deno.env.get("LOVABLE_API_KEY") ?? "").trim();
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "AI is not configured (missing LOVABLE_API_KEY)" }, 501);
    }

    let systemPrompt: string;
    let userContent: string;

    if (mode === "insights") {
      systemPrompt =
        "You are FieldFlow AI, a proactive business intelligence assistant for field-service companies. " +
        "Analyze the provided dashboard data and return EXACTLY a JSON array of insight objects. " +
        "Each object must have: " +
        '  "type": one of "alert", "suggestion", "warning", "tip" ' +
        '  "icon": one of "flame", "dollar", "clock", "wrench", "users", "alert-triangle", "trending-up", "package" ' +
        '  "title": short headline (max 60 chars) ' +
        '  "body": actionable 1-2 sentence explanation ' +
        '  "severity": one of "critical", "warning", "info" ' +
        "Rules: " +
        "- Look for: overdue/unpaid invoices, technicians with high callback rates, unassigned jobs, " +
        "  customers without recent jobs (upsell opportunities), low stock items, scheduling gaps, " +
        "  revenue trends, sites without recent visits, techs with no jobs today. " +
        "- Return 3-6 insights, most critical first. " +
        "- If data is too sparse, give helpful tips for getting started. " +
        "- Return ONLY the JSON array, no markdown, no explanation.";

      userContent = `Analyze this dashboard data and provide proactive insights:\n${context}`;
    } else {
      systemPrompt =
        "You are FieldFlow AI, an assistant inside an admin dashboard for a field-service business. " +
        "Be concise, practical, and action-oriented. If context is missing, ask one short clarifying question.";

      userContent = context
        ? `User request:\n${message}\n\nDashboard context (may be partial):\n${context}`
        : message;
    }

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

    if (mode === "insights") {
      // Try to parse as JSON array
      try {
        // Strip markdown code fences if present
        let cleaned = text.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
        }
        const insights = JSON.parse(cleaned);
        return jsonResponse({ insights }, 200);
      } catch {
        // Return raw text as fallback
        return jsonResponse({ text: text.trim() }, 200);
      }
    }

    return jsonResponse({ text: text.trim() }, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("ai-assistant error:", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
