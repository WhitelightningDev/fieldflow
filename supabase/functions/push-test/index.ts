import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";
import webpush from "web-push";

const ALLOWED_ORIGINS = new Set([
  "https://fieldflow-billing.vercel.app",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://[::1]:8000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function corsHeadersFor(origin: string | null) {
  if (!origin) return null;
  if (!ALLOWED_ORIGINS.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, x-supabase-*",
    Vary: "Origin",
  } as const;
}

function jsonResponse(body: unknown, status: number, corsHeaders: Record<string, string> | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...(corsHeaders ?? {}),
      "Content-Type": "application/json",
    },
  });
}

function readTextBody(req: Request) {
  return req.text().catch(() => "");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = corsHeadersFor(origin);

  if (origin && !corsHeaders) {
    if (req.method === "OPTIONS") return new Response(null, { status: 403 });
    return jsonResponse({ error: "CORS blocked" }, 403, null);
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders ?? {} });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Missing auth header" }, 401, corsHeaders);
  }

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const anonKey = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ error: "Missing Supabase env vars" }, 500, corsHeaders);
  }

  const subject = (Deno.env.get("WEB_PUSH_SUBJECT") ?? "").trim();
  const vapidPublicKey = (Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY") ?? "").trim();
  const vapidPrivateKey = (Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY") ?? "").trim();
  if (!subject || !vapidPublicKey || !vapidPrivateKey) {
    return jsonResponse(
      {
        error:
          "Web Push is not configured (missing WEB_PUSH_SUBJECT/WEB_PUSH_VAPID_PUBLIC_KEY/WEB_PUSH_VAPID_PRIVATE_KEY).",
      },
      501,
      corsHeaders,
    );
  }

  try {
    webpush.setVapidDetails(subject, vapidPublicKey, vapidPrivateKey);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid VAPID configuration";
    return jsonResponse({ error: msg }, 500, corsHeaders);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader, apikey: anonKey } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user }, error: userError } = await callerClient.auth.getUser(token);
  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
  }

  let rawBody: any = null;
  try {
    const text = await readTextBody(req);
    rawBody = text ? JSON.parse(text) : null;
  } catch {
    rawBody = null;
  }

  const title = String(rawBody?.title ?? "FieldFlow test push").trim();
  const body = String(rawBody?.body ?? "If you can read this, background push is working.").trim();
  const url = String(rawBody?.url ?? "/tech").trim();
  const tag = typeof rawBody?.tag === "string" ? rawBody.tag.trim() : undefined;

  const { data: rows, error: subError } = await (callerClient as any)
    .from("web_push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_id", user.id);

  if (subError) {
    return jsonResponse({ error: subError.message ?? "Failed to load subscriptions" }, 500, corsHeaders);
  }

  const subs = Array.isArray(rows) ? rows : [];
  if (subs.length === 0) {
    return jsonResponse({ error: "No push subscriptions found for this user." }, 400, corsHeaders);
  }

  let sent = 0;
  let removed = 0;

  const payload = JSON.stringify({ title, body, url, tag });

  for (const s of subs) {
    const endpoint = String((s as any)?.endpoint ?? "");
    const p256dh = String((s as any)?.p256dh ?? "");
    const auth = String((s as any)?.auth ?? "");
    if (!endpoint || !p256dh || !auth) continue;

    try {
      await webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, payload);
      sent += 1;
    } catch (e: any) {
      const code = typeof e?.statusCode === "number" ? e.statusCode : typeof e?.status === "number" ? e.status : null;
      if (code === 404 || code === 410) {
        removed += 1;
        try {
          await (callerClient as any)
            .from("web_push_subscriptions")
            .delete()
            .eq("user_id", user.id)
            .eq("endpoint", endpoint);
        } catch {
          // ignore
        }
      }
      console.error("push send failed:", code ?? "unknown", String(e?.message ?? e));
    }
  }

  return jsonResponse({ ok: true, sent, removed, total: subs.length }, 200, corsHeaders);
});

