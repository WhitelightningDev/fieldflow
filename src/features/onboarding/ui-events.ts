export const ONBOARDING_DIALOG_EVENT = "fieldflow:onboarding:dialog";

export type OnboardingDialogKey =
  | "create-customer"
  | "create-site"
  | "create-technician-primary";

export type OnboardingDialogEventDetail = {
  key: OnboardingDialogKey;
  open: boolean;
};

function isValidDetail(v: unknown): v is OnboardingDialogEventDetail {
  if (!v || typeof v !== "object") return false;
  const obj = v as any;
  const key = obj.key;
  const open = obj.open;
  if (typeof open !== "boolean") return false;
  return (
    key === "create-customer" ||
    key === "create-site" ||
    key === "create-technician-primary"
  );
}

export function emitOnboardingDialog(detail: OnboardingDialogEventDetail) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(ONBOARDING_DIALOG_EVENT, { detail }));
  } catch {
    // ignore
  }
}

export function subscribeOnboardingDialog(
  handler: (detail: OnboardingDialogEventDetail) => void,
) {
  if (typeof window === "undefined") return () => {};

  const listener = (e: Event) => {
    const detail = (e as CustomEvent)?.detail as unknown;
    if (!isValidDetail(detail)) return;
    handler(detail);
  };

  window.addEventListener(ONBOARDING_DIALOG_EVENT, listener as EventListener);
  return () => window.removeEventListener(ONBOARDING_DIALOG_EVENT, listener as EventListener);
}

