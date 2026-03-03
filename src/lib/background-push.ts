import { supabase } from "@/integrations/supabase/client";
import { getFunctionsInvokeErrorMessage } from "@/lib/supabase-error";

const VAPID_PUBLIC_KEY = (import.meta as any).env?.VITE_WEB_PUSH_VAPID_PUBLIC_KEY as string | undefined;

export function isBackgroundPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function ensureServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) return null;

  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;

  // In dev we don't auto-register via `src/pwa.ts`, so register on-demand.
  // Try absolute first (normal web), then relative (Capacitor / non-root).
  try {
    return await navigator.serviceWorker.register("/sw.js", { type: "module" });
  } catch {
    try {
      return await navigator.serviceWorker.register("/sw.js");
    } catch {
      try {
        return await navigator.serviceWorker.register("sw.js", { type: "module" });
      } catch {
        try {
          return await navigator.serviceWorker.register("sw.js");
        } catch {
          return null;
        }
      }
    }
  }
}

function toRow(subscription: PushSubscription) {
  const json = subscription.toJSON();
  const endpoint = typeof json?.endpoint === "string" ? json.endpoint : "";
  const p256dh = typeof (json as any)?.keys?.p256dh === "string" ? (json as any).keys.p256dh : "";
  const auth = typeof (json as any)?.keys?.auth === "string" ? (json as any).keys.auth : "";
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, p256dh, auth };
}

export async function getBackgroundPushSubscription() {
  if (!isBackgroundPushSupported()) return null;
  const reg = await ensureServiceWorkerRegistration() as any;
  if (!reg?.pushManager) return null;
  return await reg.pushManager.getSubscription();
}

export async function enableBackgroundPush(userId: string) {
  if (!isBackgroundPushSupported()) {
    return { ok: false as const, error: "Push is not supported on this device/browser." };
  }
  if (!VAPID_PUBLIC_KEY) {
    return { ok: false as const, error: "Missing VAPID public key (VITE_WEB_PUSH_VAPID_PUBLIC_KEY)." };
  }

  const reg = await ensureServiceWorkerRegistration() as any;
  if (!reg?.pushManager) {
    return { ok: false as const, error: "Service worker is not available." };
  }

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const row = toRow(subscription);
  if (!row) {
    try {
      await subscription.unsubscribe();
    } catch {
      // ignore
    }
    return { ok: false as const, error: "Push subscription did not include required keys." };
  }

  const sb: any = supabase;
  const { error } = await sb
    .from("web_push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      },
      { onConflict: "user_id,endpoint" },
    );

  if (error) {
    try {
      await subscription.unsubscribe();
    } catch {
      // ignore
    }
    return { ok: false as const, error: error.message ?? "Failed to save subscription." };
  }

  return { ok: true as const, subscription };
}

export async function disableBackgroundPush(userId: string) {
  const subscription = await getBackgroundPushSubscription();
  if (!subscription) return { ok: true as const };

  const row = toRow(subscription);

  try {
    await subscription.unsubscribe();
  } catch {
    // ignore
  }

  if (row) {
    const sb: any = supabase;
    await sb
      .from("web_push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", row.endpoint);
  }

  return { ok: true as const };
}

export async function sendTestBackgroundPush(payload?: { title?: string; body?: string; url?: string }) {
  const { data, error } = await supabase.functions.invoke("push-test", {
    body: {
      title: payload?.title ?? "FieldFlow test push",
      body: payload?.body ?? "If you can read this, background push is working.",
      url: payload?.url ?? "/tech",
    },
  });
  if (error) return { ok: false as const, error: await getFunctionsInvokeErrorMessage(error, { functionName: "push-test" }) };
  return { ok: true as const, data };
}
