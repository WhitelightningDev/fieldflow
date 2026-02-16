import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

type InviteTechnicianPayload = {
  technicianId: string;
  companyId: string;
  industry?: string | null;
  redirectTo?: string | null;
  password?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(obj: Record<string, unknown>, key: string) {
  const value = obj[key];
  return typeof value === "string" ? value : "";
}

function getOptionalString(obj: Record<string, unknown>, key: string) {
  const value = obj[key];
  return typeof value === "string" ? value : undefined;
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
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Caller client (to verify identity via explicit token validation)
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser(token);
    if (callerError || !caller) {
      console.log("Auth validation failed:", callerError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client for user creation
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let rawBody: unknown = null;
    try {
      rawBody = await req.json();
    } catch {
      rawBody = null;
    }

    const bodyObj = isRecord(rawBody) ? rawBody : {};
    const body: InviteTechnicianPayload = {
      technicianId: getString(bodyObj, "technicianId"),
      companyId: getString(bodyObj, "companyId"),
      industry: getOptionalString(bodyObj, "industry"),
      redirectTo: getOptionalString(bodyObj, "redirectTo"),
      password: getOptionalString(bodyObj, "password"),
    };

    const { technicianId, companyId, industry, redirectTo, password } = body;

    if (!technicianId || !companyId || !password) {
      return new Response(JSON.stringify({ error: "Missing required fields (technicianId, companyId, password)" }), {
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

    // Verify caller has permission to invite
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

    // Verify the technician record is in this company
    const { data: techRow } = await adminClient
      .from("technicians")
      .select("id, company_id, email, name, user_id")
      .eq("id", technicianId)
      .maybeSingle();
    if (!techRow || techRow.company_id !== companyId) {
      return new Response(JSON.stringify({ error: "Technician not found for this company" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = (techRow.email ?? "").trim();
    const name = (techRow.name ?? "").trim();
    if (!email) {
      return new Response(JSON.stringify({ error: "Technician must have an email to create login access" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create/update the auth user with a password (no email verification step)
    console.log("Provisioning technician access:", { email, companyId, redirectTo });
    const publicSiteUrl = Deno.env.get("PUBLIC_SITE_URL")?.trim();
    const fallbackRedirectTo = publicSiteUrl ? `${publicSiteUrl.replace(/\/+$/, "")}/auth/callback` : undefined;
    const effectiveRedirect = redirectTo || fallbackRedirectTo;

    const userMetadata = {
      full_name: name,
      company_id: companyId,
      industry: industry ?? "general",
      role: "technician",
    };

    let userId: string | null = techRow.user_id ?? null;
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

    // Generate a one-time portal link (no email sending; admin can copy/share)
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: effectiveRedirect ? { redirectTo: effectiveRedirect } : undefined,
    } as any);
    if (linkError) {
      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const loginLink = linkData.properties?.action_link ?? null;

    // Link technician to auth user (columns exist via migrations)
    const { error: techUpdateError } = await adminClient
      .from("technicians")
      .update({ user_id: userId, invite_status: "invited", invited_at: new Date().toISOString() })
      .eq("id", technicianId);
    if (techUpdateError) {
      console.log("Technician update failed (safe to ignore):", techUpdateError.message);
    }

    // Create profile for the technician
    await adminClient
      .from("profiles")
      .upsert(
        { user_id: userId, full_name: name, email, company_id: companyId },
        { onConflict: "user_id" },
      );

    // Assign technician role
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
