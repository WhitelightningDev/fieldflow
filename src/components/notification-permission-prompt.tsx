import * as React from "react";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";
import {
  isSystemNotificationsSupported,
  getSystemNotificationPermission,
  requestSystemNotificationPermission,
  setSystemNotificationsEnabled,
} from "@/lib/system-notifications";

const ASKED_KEY = "ff_notif_permission_asked";

/**
 * A non-intrusive prompt that appears once to ask the user
 * to enable push notifications. Important for technicians and customers
 * who need real-time updates even when the phone is idle.
 */
export default function NotificationPermissionPrompt() {
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!isSystemNotificationsSupported()) return;
    const perm = getSystemNotificationPermission();
    if (perm === "granted" || perm === "denied") return;

    try {
      if (localStorage.getItem(ASKED_KEY)) return;
    } catch {}

    const timer = setTimeout(() => setShow(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(ASKED_KEY, "1"); } catch {}
    setShow(false);
  };

  const enable = async () => {
    setBusy(true);
    try {
      const result = await requestSystemNotificationPermission();
      if (result === "granted") {
        setSystemNotificationsEnabled(true);
      }
      try { localStorage.setItem(ASKED_KEY, "1"); } catch {}
    } catch {}
    setBusy(false);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[95] animate-fade-in sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card shadow-lg px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Bell className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">Enable notifications</p>
          <p className="text-xs text-muted-foreground mt-1">
            Get alerts for new jobs, messages, and status updates — even when your phone is locked.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <Button type="button" size="sm" className="h-7 px-3 text-xs" disabled={busy} onClick={enable}>
              {busy ? "Enabling…" : "Enable"}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={dismiss}>
              Later
            </Button>
          </div>
        </div>
        <button type="button" onClick={dismiss} className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
