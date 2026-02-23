import * as React from "react";

const EVENT_NAME = "fieldflow:trial-banner-dismissal";

function keyFor(companyId: string) {
  return `trial_banner_dismissed_until:${companyId}`;
}

function safeGetItem(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeRemoveItem(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function emit() {
  try {
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {
    // ignore
  }
}

export function useTrialBannerDismissal(args: { companyId?: string | null; endsAt?: Date | null }) {
  const companyId = args.companyId ?? null;
  const endsAtIso = args.endsAt ? args.endsAt.toISOString() : null;
  const storageKey = companyId ? keyFor(companyId) : null;

  const readDismissed = React.useCallback(() => {
    if (!storageKey || !endsAtIso) return false;
    const stored = safeGetItem(storageKey);
    return stored === endsAtIso;
  }, [endsAtIso, storageKey]);

  const [dismissed, setDismissed] = React.useState(() => readDismissed());

  React.useEffect(() => {
    setDismissed(readDismissed());
  }, [readDismissed]);

  React.useEffect(() => {
    const onChange = () => setDismissed(readDismissed());
    window.addEventListener(EVENT_NAME, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [readDismissed]);

  const dismiss = React.useCallback(() => {
    if (!storageKey || !endsAtIso) return;
    safeSetItem(storageKey, endsAtIso);
    setDismissed(true);
    emit();
  }, [endsAtIso, storageKey]);

  const restore = React.useCallback(() => {
    if (!storageKey) return;
    safeRemoveItem(storageKey);
    setDismissed(false);
    emit();
  }, [storageKey]);

  return { dismissed, dismiss, restore };
}

