import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";

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

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);

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
          setNotifications((prev) => [payload.new as Notification, ...prev]);
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

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, loading, unreadCount, markAsRead, markAllAsRead, refetch: fetchNotifications };
}
