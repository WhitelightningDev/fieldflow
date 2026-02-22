import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TutorialPlacement, TutorialStep } from "@/features/onboarding/types";

type Props = {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  missingTarget: boolean;
  isBusy?: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computePosition(args: {
  placement: TutorialPlacement;
  rect: DOMRect;
  cardW: number;
  cardH: number;
  margin: number;
  viewportW: number;
  viewportH: number;
}) {
  const { placement, rect, cardW, cardH, margin, viewportW, viewportH } = args;

  let left = rect.left + rect.width / 2 - cardW / 2;
  let top = rect.top + rect.height / 2 - cardH / 2;

  if (placement === "top") top = rect.top - cardH - margin;
  if (placement === "bottom") top = rect.bottom + margin;
  if (placement === "left") left = rect.left - cardW - margin;
  if (placement === "right") left = rect.right + margin;

  // Clamp within the viewport so the card never renders off-screen.
  left = clamp(left, 12, Math.max(12, viewportW - cardW - 12));
  top = clamp(top, 12, Math.max(12, viewportH - cardH - 12));

  return { left, top };
}

export function TutorialCard({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  missingTarget,
  isBusy,
  onNext,
  onBack,
  onSkip,
  onFinish,
}: Props) {
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);

  const isFirst = stepIndex <= 0;
  const isLast = stepIndex >= totalSteps - 1;

  React.useLayoutEffect(() => {
    const el = cardRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!el) return;

    const { width, height } = el.getBoundingClientRect();

    if (!targetRect || missingTarget) {
      setPos({ left: Math.max(12, (vw - width) / 2), top: Math.max(12, (vh - height) / 2) });
      return;
    }

    setPos(
      computePosition({
        placement: step.placement,
        rect: targetRect,
        cardW: width,
        cardH: height,
        margin: 12,
        viewportW: vw,
        viewportH: vh,
      }),
    );
  }, [step.id, step.placement, targetRect, missingTarget]);

  return (
    <div
      ref={cardRef}
      className={cn(
        "pointer-events-auto",
        "fixed z-[10000] w-[360px] max-w-[calc(100vw-24px)] rounded-xl border bg-background/95 shadow-xl backdrop-blur-sm",
        "text-foreground",
      )}
      style={pos ? { left: pos.left, top: pos.top } : { left: 12, top: 12 }}
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding tutorial"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Step {Math.min(totalSteps, stepIndex + 1)} of {totalSteps}</div>
            <div className="text-base font-semibold leading-snug">{step.title}</div>
          </div>
        </div>

        <div className="mt-2 text-sm text-muted-foreground">{step.description}</div>

        {missingTarget && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-200">
            We couldn’t find this element on the page yet. You can still continue.
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={Boolean(isBusy)} onClick={onSkip}>
            Skip
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={isFirst || Boolean(isBusy)} onClick={onBack}>
              Back
            </Button>
            {isLast ? (
              <Button type="button" size="sm" disabled={Boolean(isBusy)} onClick={onFinish}>
                Finish
              </Button>
            ) : (
              <Button type="button" size="sm" disabled={Boolean(isBusy)} onClick={onNext}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
