import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

type InviteTechnicianPayload = {
  companyId: string;
  industry?: string | null;
  password?: string | null;
  technicianId?: string | null;
  email?: string | null;
  name?: string | null;
};

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

function getStringAny(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function getOptionalStringAny(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

function getOptionalNonEmptyStringAny(obj: Record<string, unknown>, keys: string[]) {
  const v = getOptionalStringAny(obj, keys);
  const s = (v ?? "").trim();
  return s ? s : undefined;
}

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
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

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser(token);
    if (callerError || !caller) {
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

    const bodyObj = unwrapPayload(rawBody);
    const body: InviteTechnicianPayload = {
      companyId: getStringAny(bodyObj, ["companyId", "company_id"]),
      industry: getOptionalStringAny(bodyObj, ["industry"]),
      password: getOptionalStringAny(bodyObj, ["password"]),
      technicianId: getOptionalNonEmptyStringAny(bodyObj, ["technicianId", "technician_id"]),
      email: getOptionalNonEmptyStringAny(bodyObj, ["email"]),
      name: getOptionalNonEmptyStringAny(bodyObj, ["name", "full_name"]),
    };

    const { technicianId, companyId, industry, password } = body;
    const providedEmail = (body.email ?? "").trim();
    const providedName = (body.name ?? "").trim();

    const isTechnicianIdMode = Boolean(technicianId);
    const isEmailMode = !isTechnicianIdMode && Boolean(providedEmail) && Boolean(providedName);

    if (!companyId || !password || (!isTechnicianIdMode && !isEmailMode)) {
      const missing: string[] = [];
      if (!companyId) missing.push("companyId");
      if (!password) missing.push("password");
      if (!isTechnicianIdMode) {
        if (!providedEmail) missing.push("email");
        if (!providedName) missing.push("name");
      }
      return new Response(JSON.stringify({ error: "Missing required fields", missing, receivedKeys: Object.keys(bodyObj) }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller belongs to this company
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("company_id")
      .eq("user_id", caller.id)
      .single();
    if (!callerProfile || callerProfile.company_id !== companyId) {
      return new Response(JSON.stringify({ error: "Not authorized for this company" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller has permission to provision technicians
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    const allowedRoles = new Set(["owner", "admin", "office_staff"]);
    const canInvite = (Array.isArray(callerRoles) ? callerRoles : []).some((row) => {
      if (!isRecord(row)) return false;
      const role = row.role;
      return typeof role === "string" && allowedRoles.has(role);
    });
    if (!canInvite) {
      return new Response(JSON.stringify({ error: "Insufficient permissions to invite technicians" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let technicianRowId: string | null = null;
    let email = "";
    let name = "";
    let existingUserId: string | null = null;

    if (isTechnicianIdMode) {
      // Verify technician exists and belongs to this company
      const { data: techRow } = await adminClient
        .from("technicians")
        .select("id, company_id, email, name, user_id")
        .eq("id", technicianId as string)
        .maybeSingle();
      if (!techRow || techRow.company_id !== companyId) {
        return new Response(JSON.stringify({ error: "Technician not found for this company" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      technicianRowId = techRow.id;
      email = (techRow.email ?? "").trim();
      name = (techRow.name ?? "").trim();
      existingUserId = (techRow.user_id as string | null | undefined) ?? null;
    } else {
      email = providedEmail;
      name = providedName;
    }

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required to create technician login access" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!name) {
      return new Response(JSON.stringify({ error: "Name is required to create technician login access" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IMPORTANT: force redirect to your canonical frontend (prevents lovableproject.com links)
    const publicSiteUrl = (Deno.env.get("PUBLIC_SITE_URL") ?? "").trim();
    const effectiveRedirectTo = publicSiteUrl ? joinUrl(publicSiteUrl, "/auth/callback?next=/tech") : undefined;

    const userMetadata = {
      full_name: name,
      company_id: companyId,
      industry: industry ?? "general",
      role: "technician",
    };

    let userId: string | null = existingUserId ?? null;
    if (userId) {
      const { data: updated, error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
        email,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
      });
      if (updateError || !updated.user) {
        return new Response(JSON.stringify({ error: updateError?.message ?? "Failed to update technician auth user" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = updated.user.id;
    } else {
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
      });
      if (createError || !created.user) {
        return new Response(JSON.stringify({ error: createError?.message ?? "Failed to create technician auth user" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = created.user.id;
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: effectiveRedirectTo ? { redirectTo: effectiveRedirectTo } : undefined,
    } as any);
    if (linkError) {
      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const loginLink = linkData.properties?.action_link ?? null;

    if (technicianRowId) {
      await adminClient
        .from("technicians")
        .update({ user_id: userId, invite_status: "invited", invited_at: new Date().toISOString() })
        .eq("id", technicianRowId);
    }

    await adminClient
      .from("profiles")
      .upsert(
        { user_id: userId, full_name: name, email, company_id: companyId },
        { onConflict: "user_id" },
      );

    await adminClient
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "technician" },
        { onConflict: "user_id,role" },
      );

    return new Response(JSON.stringify({ success: true, userId, loginLink }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
