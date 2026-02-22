import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Spotlight } from "@/features/onboarding/Spotlight";
import { TutorialCard } from "@/features/onboarding/TutorialCard";
import { useOnboardingController } from "@/features/onboarding/OnboardingProvider";

function findTarget(selector: string) {
  try {
    return document.querySelector(selector) as HTMLElement | null;
  } catch {
    return null;
  }
}

export function OnboardingOverlay() {
  const controller = useOnboardingController();
  const navigate = useNavigate();
  const location = useLocation();

  const step = controller?.activeStep ?? null;
  const isOpen = Boolean(controller?.isOpen && step);

  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);
  const [missingTarget, setMissingTarget] = React.useState(false);

  const lastNavStepIdRef = React.useRef<string | null>(null);
  const scrollAttemptedRef = React.useRef<string | null>(null);
  const autoClickAttemptedRef = React.useRef(new Set<string>());

  // Expose a global flag so dismissible layers (Dialog/Sheet) can avoid closing
  // when interacting with the tutorial wizard UI (which sits "outside" the modal).
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (isOpen) {
      document.documentElement.dataset.onboardingOverlayOpen = "1";
    } else {
      delete document.documentElement.dataset.onboardingOverlayOpen;
    }
    return () => {
      delete document.documentElement.dataset.onboardingOverlayOpen;
    };
  }, [isOpen]);

  // Navigate to the step route (if needed) and then look for the target.
  React.useEffect(() => {
    if (!isOpen || !step) {
      setTargetRect(null);
      setMissingTarget(false);
      return;
    }

    let cancelled = false;
    setTargetRect(null);
    setMissingTarget(false);

    if (step.route && location.pathname !== step.route) {
      if (lastNavStepIdRef.current !== step.id) {
        lastNavStepIdRef.current = step.id;
        navigate(step.route);
      }
      return;
    }

    lastNavStepIdRef.current = null;

    const startedAt = Date.now();
    const showWarningAfterMs = 1200;

    const tick = () => {
      if (cancelled) return;
      const el = findTarget(step.targetSelector);
      if (el) {
        // Best-effort scroll so the element is visible (only once per step).
        if (scrollAttemptedRef.current !== step.id) {
          scrollAttemptedRef.current = step.id;
          try {
            el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
          } catch {
            // ignore
          }
        }
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        setMissingTarget(false);
        return;
      }

      // If the step depends on opening UI (like a modal), attempt it once.
      if (step.autoClickSelector && !autoClickAttemptedRef.current.has(step.id)) {
        const opener = findTarget(step.autoClickSelector);
        if (opener) {
          autoClickAttemptedRef.current.add(step.id);
          // Avoid toggling UI closed if the opener is already in an "open" state.
          // Radix triggers typically expose `data-state="open"` (and/or `aria-expanded="true"`).
          const state = opener.getAttribute("data-state");
          const expanded = opener.getAttribute("aria-expanded");
          if (state === "open" || expanded === "true") {
            // The UI is already open; clicking again could close it.
          } else {
          try {
            opener.click();
          } catch {
            // ignore
          }
          }
        }
      }

      setTargetRect(null);
      if (Date.now() - startedAt >= showWarningAfterMs) setMissingTarget(true);
    };

    tick();
    const intervalId = window.setInterval(tick, 250);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isOpen, step?.id, step?.route, step?.targetSelector, step?.autoClickSelector, location.pathname, navigate]);

  // Escape to skip (best-effort).
  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      controller?.actions.skip();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, controller]);

  if (!controller || !isOpen || !step) return null;

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none">
      <Spotlight rect={targetRect} mode="outline" />
      <TutorialCard
        step={step}
        stepIndex={controller.currentStepIndex}
        totalSteps={controller.steps.length}
        targetRect={targetRect}
        missingTarget={missingTarget}
        isBusy={controller.isLoading}
        onBack={controller.actions.back}
        onNext={controller.actions.next}
        onSkip={controller.actions.skip}
        onFinish={controller.actions.finish}
      />
    </div>
  );
}
