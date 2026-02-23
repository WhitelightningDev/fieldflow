import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useNotifications, type Notification } from "@/hooks/use-notifications";
import {
  explainDeniedNotifications,
  getSystemNotificationPermission,
  getSystemNotificationsEnabled,
  isSystemNotificationsSupported,
  requestSystemNotificationPermission,
  setSystemNotificationsEnabled,
  showSystemNotification,
} from "@/lib/system-notifications";
import { formatDistanceToNow } from "date-fns";
import { useLocation, useNavigate } from "react-router-dom";
import * as React from "react";

const typeIcon: Record<string, string> = {
  job_assigned: "🔧",
  job_status_changed: "📋",
  chat_message: "💬",
  info: "ℹ️",
};

function NotificationItem({
  notification,
  onRead,
  onNavigate,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onNavigate?: (n: Notification) => void;
}) {
  return (
    <button
      className={`w-full text-left px-3 py-2.5 border-b border-border/50 last:border-0 transition-colors hover:bg-muted/50 ${
        !notification.read ? "bg-primary/5" : ""
      }`}
      onClick={() => {
        onRead(notification.id);
        onNavigate?.(notification);
      }}
    >
      <div className="flex items-start gap-2">
        <span className="text-base mt-0.5">{typeIcon[notification.type] ?? "🔔"}</span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm leading-tight ${!notification.read ? "font-semibold" : "font-medium text-muted-foreground"}`}>
            {notification.title}
          </p>
          {notification.body && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
          )}
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </p>
        </div>
        {!notification.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
      </div>
    </button>
  );
}

export default function NotificationBell({ basePath = "/dashboard" }: { basePath?: string }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, markChatAsRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = React.useState(false);
  const [permission, setPermission] = React.useState<NotificationPermission | "unsupported">(() => getSystemNotificationPermission());
  const [enabled, setEnabled] = React.useState<boolean>(() => (typeof window === "undefined" ? false : getSystemNotificationsEnabled()));
  const [requesting, setRequesting] = React.useState(false);

  const isMessagesPage = React.useMemo(() => {
    const p = location.pathname;
    if (basePath === "/tech") return p.startsWith("/tech/messages");
    return p.startsWith("/dashboard/messages");
  }, [basePath, location.pathname]);

  const displayUnreadCount = React.useMemo(() => {
    if (!isMessagesPage) return unreadCount;
    return notifications.filter((n) => !n.read && n.type !== "chat_message").length;
  }, [isMessagesPage, notifications, unreadCount]);

  const clearingChatRef = React.useRef(false);
  React.useEffect(() => {
    if (!isMessagesPage) return;
    if (clearingChatRef.current) return;
    if (!notifications.some((n) => !n.read && n.type === "chat_message")) return;
    clearingChatRef.current = true;
    Promise.resolve(markChatAsRead())
      .catch(() => {
        // ignore
      })
      .finally(() => {
        clearingChatRef.current = false;
      });
  }, [isMessagesPage, markChatAsRead, notifications]);

  React.useEffect(() => {
    if (!open) return;
    setPermission(getSystemNotificationPermission());
    setEnabled(getSystemNotificationsEnabled());
  }, [open]);

  const handleNavigate = (n: Notification) => {
    const jobCardId = n.metadata?.job_card_id;
    if (jobCardId) {
      if (basePath === "/tech") {
        navigate(`/tech/job/${jobCardId}`);
      } else {
        navigate("/dashboard/jobs");
      }
      setOpen(false);
      return;
    }

    const chatThreadId = n.metadata?.chat_thread_id;
    if (chatThreadId) {
      if (basePath === "/tech") {
        navigate(`/tech/messages?thread=${chatThreadId}`);
      } else {
        navigate(`/dashboard/messages?thread=${chatThreadId}`);
      }
      setOpen(false);
      return;
    }

    if (n.type === "chat_message") {
      if (basePath === "/tech") navigate("/tech/messages");
      else navigate("/dashboard/messages");
      setOpen(false);
      return;
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {displayUnreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-[10px] flex items-center justify-center bg-destructive text-destructive-foreground">
              {displayUnreadCount > 9 ? "9+" : displayUnreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {displayUnreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
        </div>

        <div className="px-3 py-2 border-b border-border space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium">Push notifications</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {permission === "unsupported"
                  ? "Not supported — install this app to your home screen first."
                  : permission === "granted"
                    ? "Enabled — you'll get alerts when the app is in the background."
                    : permission === "denied"
                      ? "Blocked — enable in your device Settings → Safari/Chrome → Notifications."
                      : "Tap Enable to receive job and message alerts."}
              </div>
            </div>
            <Switch
              checked={enabled && permission === "granted"}
              disabled={permission !== "granted"}
              onCheckedChange={(v) => {
                setEnabled(Boolean(v));
                setSystemNotificationsEnabled(Boolean(v));
              }}
              aria-label="Enable device notifications"
            />
          </div>

          {isSystemNotificationsSupported() && permission !== "granted" ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={requesting}
                onClick={async () => {
                  setRequesting(true);
                  const p = await requestSystemNotificationPermission();
                  setRequesting(false);
                  setPermission(p);
                  if (p === "granted") {
                    setEnabled(true);
                    setSystemNotificationsEnabled(true);
                    await showSystemNotification({ title: "FieldFlow notifications enabled", body: "You'll receive job updates here." });
                  } else if (p === "denied") {
                    explainDeniedNotifications();
                  }
                }}
              >
                {requesting ? "Requesting..." : permission === "denied" ? "Retry" : "Enable"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={async () => {
                  setPermission(getSystemNotificationPermission());
                  await showSystemNotification({ title: "Test notification", body: "If you can read this, alerts are working." });
                }}
              >
                Test
              </Button>
            </div>
          ) : permission === "granted" ? (
            <div className="flex items-center justify-end">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => showSystemNotification({ title: "Test notification", body: "If you can read this, alerts are working." })}
              >
                Test
              </Button>
            </div>
          ) : null}
        </div>

        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No notifications yet</div>
          ) : (
            notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onRead={markAsRead} onNavigate={handleNavigate} />
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
