import { toast } from "@/components/ui/use-toast";

export type SystemNotificationPayload = {
  title: string;
  body?: string | null;
  tag?: string;
};

const ENABLE_KEY = "fieldflow_system_notifications_enabled";

export function isSystemNotificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getSystemNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isSystemNotificationsSupported()) return "unsupported";
  return Notification.permission;
}

export function getSystemNotificationsEnabled() {
  try {
    const v = window.localStorage.getItem(ENABLE_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    // ignore
  }
  // Default: if the browser already granted permission, enable by default.
  return getSystemNotificationPermission() === "granted";
}

export function setSystemNotificationsEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(ENABLE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore
  }
  if (enabled) {
    try {
      void (navigator as any).storage?.persist?.();
    } catch {
      // ignore
    }
  }
}

export async function requestSystemNotificationPermission() {
  if (!isSystemNotificationsSupported()) return "unsupported" as const;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showSystemNotification(payload: SystemNotificationPayload) {
  if (!isSystemNotificationsSupported()) return false;
  if (Notification.permission !== "granted") return false;

  const title = payload.title;
  const body = payload.body ?? undefined;
  const tag = payload.tag;
  const icon = "/pwa-192.png";
  const badge = "/pwa-192.png";

  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) {
      await reg.showNotification(title, {
        body,
        tag,
        icon,
        badge,
        renotify: Boolean(tag),
        requireInteraction: false,
        data: { url: window.location.href },
        // vibrate is supported on Android but not in all TS typings
        ...(({ vibrate: [100, 50, 100] }) as any),
      } as NotificationOptions);
      return true;
    }
  } catch {
    // fall back
  }

  try {
    // eslint-disable-next-line no-new
    new Notification(title, { body, tag, icon, badge });
    return true;
  } catch {
    return false;
  }
}

export function explainDeniedNotifications() {
  toast({
    title: "Notifications blocked",
    description: "Enable notifications in your browser/device settings for this site/app, then try again.",
    variant: "destructive",
  });
}
