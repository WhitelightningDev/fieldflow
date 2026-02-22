import * as React from "react";
import { Button } from "@/components/ui/button";
import { applyPwaUpdate, isPwaUpdateAvailable, subscribePwaUpdate } from "@/pwa";

function isStandalone() {
  // iOS Safari (added to home screen) uses navigator.standalone.
  const navAny = navigator as any;
  if (typeof navAny?.standalone === "boolean") return Boolean(navAny.standalone);
  // Most modern browsers.
  return window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
}

export default function PwaUpdatePrompt() {
  const [open, setOpen] = React.useState(false);
  const [standalone, setStandalone] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setStandalone(isStandalone());
    // Initial check (covers refresh where the flag is already set).
    if (isPwaUpdateAvailable()) setOpen(true);

    // Also respect the localStorage marker in case the module state was lost.
    try {
      if (window.localStorage.getItem("fieldflow_pwa_update_available") === "1") setOpen(true);
    } catch {
      // ignore
    }

    return subscribePwaUpdate(() => setOpen(true));
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-xl rounded-xl border bg-background/95 shadow-lg backdrop-blur p-4">
        <div className="text-sm font-semibold">Update available</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {standalone
            ? "A new version is ready. Please close the app completely and open it again to update."
            : "A new version is ready. Reload to update."}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              try {
                window.localStorage.removeItem("fieldflow_pwa_update_available");
              } catch {
                // ignore
              }
              setOpen(false);
            }}
          >
            Later
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                // Best-effort: this activates the waiting service worker and reloads.
                await applyPwaUpdate();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Updating..." : standalone ? "Update now" : "Reload"}
          </Button>
        </div>
      </div>
    </div>
  );
}

