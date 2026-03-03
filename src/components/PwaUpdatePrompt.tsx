import * as React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";
import { applyPwaUpdate, isPwaUpdateAvailable, subscribePwaUpdate } from "@/pwa";

function isStandalone() {
  const navAny = navigator as any;
  if (typeof navAny?.standalone === "boolean") return Boolean(navAny.standalone);
  return window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
}

export default function PwaUpdatePrompt() {
  const [open, setOpen] = React.useState(false);
  const [standalone, setStandalone] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setStandalone(isStandalone());
    if (isPwaUpdateAvailable()) setOpen(true);

    try {
      if (window.localStorage.getItem("fieldflow_pwa_update_available") === "1") setOpen(true);
    } catch {
      // ignore
    }

    return subscribePwaUpdate(() => setOpen(true));
  }, []);

  const handleDismiss = React.useCallback(() => {
    try {
      window.localStorage.removeItem("fieldflow_pwa_update_available");
    } catch {
      // ignore
    }
    setOpen(false);
  }, []);

  const handleUpdate = React.useCallback(async () => {
    setBusy(true);
    try {
      await applyPwaUpdate();
      // Force reload after a short delay if applyPwaUpdate didn't reload
      window.setTimeout(() => {
        try {
          window.localStorage.removeItem("fieldflow_pwa_update_available");
        } catch {
          // ignore
        }
        window.location.reload();
      }, 1500);
    } catch {
      // Fallback: just reload the page
      try {
        window.localStorage.removeItem("fieldflow_pwa_update_available");
      } catch {
        // ignore
      }
      window.location.reload();
    }
  }, []);

  if (!open) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] animate-fade-in">
      <div className="flex items-center gap-3 rounded-lg border bg-card shadow-lg backdrop-blur px-4 py-3 max-w-sm">
        <RefreshCw className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">Update available</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {standalone ? "Close & reopen the app to update." : "Reload to get the latest version."}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={handleUpdate}
            className="h-7 px-3 text-xs"
          >
            {busy ? "Updating…" : standalone ? "Update" : "Reload"}
          </Button>
          <button
            type="button"
            disabled={busy}
            onClick={handleDismiss}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
