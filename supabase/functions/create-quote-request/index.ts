import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status: number, origin?: string) {
  const headers: Record<string, string> = {
    ...corsHeaders,
    "Content-Type": "application/json",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

// Simple in-memory rate limiter (per-isolate, resets on cold start)
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per window
const RATE_WINDOW_MS = 60_000; // 1 minute

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const origin = req.headers.get("Origin") ?? "";

  // Rate limit by origin + IP hint
  const clientIp = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "unknown";
  if (isRateLimited(`${origin}:${clientIp}`)) {
    return jsonResponse({ error: "Too many requests. Please try again later." }, 429, origin);
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, origin);
  }

  const companyPublicKey = String(body.company_public_key ?? "").trim();
  const quoteLinkToken = String(body.quote_link_token ?? "").trim();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = typeof body.phone === "string" ? body.phone.trim() : null;
  const trade = typeof body.trade === "string" ? body.trade.trim() : null;
  const address = typeof body.address === "string" ? body.address.trim() : null;
  const message = typeof body.message === "string" ? body.message.trim() : null;

  // Validate required fields
  if (!companyPublicKey && !quoteLinkToken) {
    return jsonResponse({ error: "Missing company_public_key or quote_link_token" }, 400, origin);
  }
  if (!name || name.length > 200) return jsonResponse({ error: "Name is required (max 200 chars)" }, 400, origin);
  if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: "Valid email is required" }, 400, origin);
  }
  if (phone && phone.length > 30) return jsonResponse({ error: "Phone too long" }, 400, origin);
  if (trade && trade.length > 100) return jsonResponse({ error: "Trade too long" }, 400, origin);
  if (address && address.length > 500) return jsonResponse({ error: "Address too long" }, 400, origin);
  if (message && message.length > 2000) return jsonResponse({ error: "Message too long (max 2000 chars)" }, 400, origin);

  // Use service role to bypass RLS
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500, origin);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Resolve company (either by public_key or by quote_link_token)
  let companyId: string | null = null;

  if (quoteLinkToken) {
    const { data: link, error: linkError } = await supabase
      .from("quote_links")
      .select("company_id, is_active")
      .eq("token", quoteLinkToken)
      .maybeSingle();

    if (linkError || !link || !link.is_active) {
      return jsonResponse({ error: "Invalid quote link" }, 404, origin);
    }

    companyId = link.company_id;
  } else {
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id")
      .eq("public_key", companyPublicKey)
      .maybeSingle();

    if (companyError || !company) {
      return jsonResponse({ error: "Invalid company key" }, 404, origin);
    }

    companyId = company.id;
  }

  // 2. Validate domain against widget_installations (only for embeddable widget installs).
  // Quote-link (QR) submissions are intended to be public and do not use domain restrictions.
  let matchedWidgetId: string | null = null;

  if (!quoteLinkToken) {
    const { data: widgets } = await supabase
      .from("widget_installations")
      .select("id, allowed_domains")
      .eq("company_id", companyId)
      .eq("is_active", true);

    if (widgets && widgets.length > 0) {
      // Extract hostname from origin
      let originHost = "";
      try {
        originHost = new URL(origin).hostname;
      } catch {
        // origin might be empty for non-browser requests
      }

      for (const w of widgets) {
        const domains = Array.isArray(w.allowed_domains) ? w.allowed_domains : [];
        // If no domains configured, allow all
        if (domains.length === 0) {
          matchedWidgetId = w.id;
          break;
        }
        // Check if origin matches any allowed domain
        const match = domains.some((d: string) => {
          const clean = d.replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();
          return originHost.toLowerCase() === clean || originHost.toLowerCase().endsWith("." + clean);
        });
        if (match) {
          matchedWidgetId = w.id;
          break;
        }
      }

      // If widgets exist but none match the domain, block
      if (!matchedWidgetId && originHost) {
        return jsonResponse({ error: "Domain not authorized for this widget" }, 403, origin);
      }

      // If no origin (e.g. server-side), use first active widget
      if (!matchedWidgetId) {
        matchedWidgetId = widgets[0].id;
      }
    }
    // If no widget installations exist at all, still allow (company hasn't configured restrictions)
  }

  // 3. Insert quote request
  const { data: quoteRow, error: insertError } = await supabase
    .from("quote_requests")
    .insert({
      company_id: companyId,
      widget_installation_id: matchedWidgetId,
      name,
      email,
      phone,
      trade,
      address,
      message,
      status: "new",
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Insert error:", insertError.message);
    return jsonResponse({ error: "Failed to submit quote request" }, 500, origin);
  }

  return jsonResponse({ ok: true, id: quoteRow.id }, 201, origin);
});
