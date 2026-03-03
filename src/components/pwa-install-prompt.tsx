import * as React from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Smartphone } from "lucide-react";

function isStandalone() {
  const navAny = navigator as any;
  if (typeof navAny?.standalone === "boolean") return Boolean(navAny.standalone);
  return window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

const DISMISSED_KEY = "ff_install_prompt_dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function PwaInstallPrompt() {
  const [show, setShow] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [installing, setInstalling] = React.useState(false);

  React.useEffect(() => {
    if (isStandalone()) return;

    // Check if dismissed recently
    try {
      const dismissedAt = localStorage.getItem(DISMISSED_KEY);
      if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DURATION_MS) return;
    } catch {}

    // Show after a short delay so it doesn't compete with initial page load
    const timer = setTimeout(() => setShow(true), 5000);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler as any);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handler as any);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {}
    setShow(false);
  };

  const install = async () => {
    if (deferredPrompt) {
      setInstalling(true);
      try {
        await deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        if (result.outcome === "accepted") {
          setShow(false);
        }
      } catch {}
      setInstalling(false);
      setDeferredPrompt(null);
    }
  };

  if (!show) return null;

  const iosInstructions = isIos();
  const androidInstructions = isAndroid() && !deferredPrompt;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[90] animate-fade-in sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card shadow-lg px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Smartphone className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">Install FieldFlow</p>
          {iosInstructions ? (
            <p className="text-xs text-muted-foreground mt-1">
              Tap the <span className="font-medium">Share</span> button, then <span className="font-medium">"Add to Home Screen"</span> to get push notifications and offline access.
            </p>
          ) : androidInstructions ? (
            <p className="text-xs text-muted-foreground mt-1">
              Tap the <span className="font-medium">browser menu (⋮)</span>, then <span className="font-medium">"Add to Home screen"</span> for the best experience.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Install for push notifications, offline access, and a native app experience.
            </p>
          )}
          <div className="mt-2.5 flex items-center gap-2">
            {deferredPrompt ? (
              <Button type="button" size="sm" className="h-7 px-3 text-xs gap-1.5" disabled={installing} onClick={install}>
                <Download className="h-3.5 w-3.5" />
                {installing ? "Installing…" : "Install"}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={dismiss}>
              Not now
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
