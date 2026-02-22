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

    const timeoutMs = 2800;
    const startedAt = Date.now();

    const poll = () => {
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

        // Measure after a paint to avoid stale rects right after navigation/scroll.
        requestAnimationFrame(() => {
          if (cancelled) return;
          setTargetRect(el.getBoundingClientRect());
          setMissingTarget(false);
        });
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        setTargetRect(null);
        setMissingTarget(true);
        return;
      }

      window.setTimeout(poll, 120);
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [isOpen, step?.id, step?.route, step?.targetSelector, location.pathname, navigate]);

  // Keep the spotlight aligned during scroll/resize while the target exists.
  React.useEffect(() => {
    if (!isOpen || !step) return;
    if (missingTarget) return;

    let raf = 0;
    const update = () => {
      const el = findTarget(step.targetSelector);
      if (!el) return;
      setTargetRect(el.getBoundingClientRect());
    };
    const onEvent = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    window.addEventListener("resize", onEvent);
    window.addEventListener("scroll", onEvent, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onEvent);
      window.removeEventListener("scroll", onEvent, true);
    };
  }, [isOpen, step?.id, step?.targetSelector, missingTarget]);

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
      {/* Click-catcher to prevent background interaction */}
      <div className="absolute inset-0 pointer-events-auto" />

      {/* If the target isn't available yet, still dim the page behind the card. */}
      {!targetRect ? <div aria-hidden="true" className="fixed inset-0 bg-black/60 pointer-events-none" /> : null}
      <Spotlight rect={targetRect} />
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
