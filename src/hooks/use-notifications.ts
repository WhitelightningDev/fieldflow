import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { getSystemNotificationsEnabled, showSystemNotification } from "@/lib/system-notifications";
import { toast } from "@/components/ui/use-toast";

export type Notification = {
  id: string;
  user_id: string;
  company_id: string;
  type: string;
  title: string;
  body: string | null;
  metadata: Record<string, any>;
  read: boolean;
  created_at: string;
};

const typeEmoji: Record<string, string> = {
  job_assigned: "🔧",
  job_status_changed: "📋",
  chat_message: "💬",
  info: "ℹ️",
};

/** Vibrate the device if supported (mobile haptic feedback) */
function vibrateDevice(pattern: number | number[] = 200) {
  try {
    navigator?.vibrate?.(pattern);
  } catch {
    // ignore — not all browsers support vibrate
  }
}

/** Show an in-app toast when the app is visible */
function showInAppToast(n: Notification) {
  const emoji = typeEmoji[n.type] ?? "🔔";
  toast({
    title: `${emoji} ${n.title}`,
    description: n.body ?? undefined,
    duration: 5000,
  });
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const lastSystemTagRef = React.useRef<string>("");

  const fetchNotifications = React.useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data as Notification[] | null) ?? []);
    setLoading(false);
  }, [user]);

  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  React.useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) => [n, ...prev]);

          // Haptic feedback on mobile
          vibrateDevice([100, 50, 100]);

          const isVisible = (() => {
            try { return document.visibilityState === "visible"; } catch { return false; }
          })();

          if (isVisible) {
            // App is in foreground — show in-app toast so the user sees it immediately
            showInAppToast(n);
          } else {
            // App is backgrounded — show system/PWA notification
            if (!getSystemNotificationsEnabled()) return;
            const tag = `n:${n.id}`;
            if (lastSystemTagRef.current === tag) return;
            lastSystemTagRef.current = tag;
            void showSystemNotification({ title: n.title, body: n.body, tag });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = React.useCallback(async (id: string) => {
    await supabase.from("notifications").update({ read: true } as any).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = React.useCallback(async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true } as any).eq("user_id", user.id).eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [user]);

  const markChatAsRead = React.useCallback(async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read: true } as any)
      .eq("user_id", user.id)
      .eq("type", "chat_message")
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => (n.type === "chat_message" ? { ...n, read: true } : n)));
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, loading, unreadCount, markAsRead, markAllAsRead, markChatAsRead, refetch: fetchNotifications };
}
