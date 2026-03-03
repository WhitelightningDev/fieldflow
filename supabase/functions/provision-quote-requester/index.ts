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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function generatePassword(length = 20) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const origin = req.headers.get("Origin") ?? "";

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Missing auth header" }, 401, origin);
  }
  const token = authHeader.replace(/^Bearer\s+/i, "");

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const callerClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerRes, error: callerError } = await callerClient.auth.getUser(token);
  const caller = callerRes?.user ?? null;
  if (callerError || !caller) {
    return jsonResponse({ error: "Unauthorized" }, 401, origin);
  }

  let rawBody: unknown = null;
  try {
    rawBody = await req.json();
  } catch {
    rawBody = null;
  }
  const body = isRecord(rawBody) ? rawBody : {};
  const quoteRequestId = String(body.quoteRequestId ?? body.quote_request_id ?? "").trim();
  if (!quoteRequestId) {
    return jsonResponse({ error: "Missing quoteRequestId" }, 400, origin);
  }

  // Authorization: must be staff and belong to the same company as the quote request.
  const { data: callerRoles, error: rolesError } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id);
  if (rolesError) return jsonResponse({ error: "Role lookup failed" }, 500, origin);
  const allowedRoles = new Set(["owner", "admin", "office_staff"]);
  const canProvision = (callerRoles ?? []).some((r: any) => allowedRoles.has(String(r?.role ?? "")));
  if (!canProvision) {
    return jsonResponse({ error: "Insufficient permissions" }, 403, origin);
  }

  const { data: callerProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("company_id")
    .eq("user_id", caller.id)
    .maybeSingle();
  if (profileError) return jsonResponse({ error: "Profile lookup failed" }, 500, origin);
  const callerCompanyId = (callerProfile as any)?.company_id ?? null;
  if (!callerCompanyId) {
    return jsonResponse({ error: "Not authorized for this company" }, 403, origin);
  }

  const { data: quote, error: quoteError } = await adminClient
    .from("quote_requests")
    .select("id, company_id, email, name, status, profile_consent, requester_user_id, portal_invited_at")
    .eq("id", quoteRequestId)
    .maybeSingle();
  if (quoteError) return jsonResponse({ error: "Quote request lookup failed" }, 500, origin);
  if (!quote) return jsonResponse({ error: "Quote request not found" }, 404, origin);
  if (quote.company_id !== callerCompanyId) {
    return jsonResponse({ error: "Not authorized for this company" }, 403, origin);
  }
  if (!quote.profile_consent) {
    return jsonResponse({ error: "Requester consent is required before creating a tracking profile." }, 400, origin);
  }

  const normalizedEmail = String(quote.email ?? "").trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return jsonResponse({ error: "Quote request email is invalid" }, 400, origin);
  }

  // 1) Determine customer user id (reuse if already linked)
  let customerUserId: string | null = quote.requester_user_id ?? null;
  if (!customerUserId) {
    const { data: prior, error: priorError } = await adminClient
      .from("quote_requests")
      .select("requester_user_id")
      .ilike("email", normalizedEmail)
      .not("requester_user_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (!priorError) {
      customerUserId = (prior as any)?.requester_user_id ?? null;
    }
  }

  // 2) Create auth user if needed
  if (!customerUserId) {
    const password = generatePassword(22);
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: String(quote.name ?? "").trim(),
      },
    });
    if (createError || !created.user) {
      return jsonResponse({ error: createError?.message ?? "Failed to create customer auth user" }, 400, origin);
    }
    customerUserId = created.user.id;
  }

  // 3) Ensure customer role exists
  await adminClient
    .from("user_roles")
    .upsert({ user_id: customerUserId, role: "customer" } as any, { onConflict: "user_id,role" });

  // 4) Ensure profile exists/updated (company_id remains null for customers)
  await adminClient
    .from("profiles")
    .upsert(
      { user_id: customerUserId, full_name: String(quote.name ?? "").trim(), email: normalizedEmail },
      { onConflict: "user_id" },
    );

  // 5) Link quote requests (all consented, across companies) to this requester
  await adminClient
    .from("quote_requests")
    .update({ requester_user_id: customerUserId })
    .eq("id", quoteRequestId);

  await adminClient
    .from("quote_requests")
    .update({ requester_user_id: customerUserId })
    .ilike("email", normalizedEmail)
    .eq("profile_consent", true)
    .is("requester_user_id", null);

  // 6) Send login email once per quote request
  const alreadyInvited = Boolean(quote.portal_invited_at);
  let emailSent = false;
  if (!alreadyInvited) {
    const publicSiteUrl = (Deno.env.get("PUBLIC_SITE_URL") ?? "").trim();
    const emailRedirectTo = publicSiteUrl ? joinUrl(publicSiteUrl, "/auth/callback?next=/portal") : undefined;

    const { error: otpError } = await adminClient.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
        shouldCreateUser: false,
      },
    });
    if (otpError) {
      return jsonResponse({ error: otpError.message }, 400, origin);
    }

    const { error: invitedError } = await adminClient
      .from("quote_requests")
      .update({ portal_invited_at: new Date().toISOString(), portal_invited_by: caller.id })
      .eq("id", quoteRequestId)
      .is("portal_invited_at", null);
    if (invitedError) {
      return jsonResponse({ error: "Failed to mark invite sent" }, 500, origin);
    }

    emailSent = true;
  }

  // 7) Ensure status is "quoted" (set last so failures don't leave the UI in a misleading state)
  if (String(quote.status ?? "") !== "quoted") {
    const { error: statusError } = await adminClient
      .from("quote_requests")
      .update({ status: "quoted" })
      .eq("id", quoteRequestId);
    if (statusError) return jsonResponse({ error: "Failed to update quote status" }, 500, origin);
  }

  return jsonResponse({ success: true, customerUserId, emailSent }, 200, origin);
});
