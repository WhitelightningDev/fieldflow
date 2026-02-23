import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Clock, AlertTriangle } from "lucide-react";
import type { TrialStatus } from "../hooks/use-trial-status";

export default function TrialBanner({ status }: { status: TrialStatus }) {
  if (status.state !== "trialing") return null;

  const urgent = status.daysLeft <= 3;
  const totalDays = 14;
  const daysLeft = Math.max(1, status.daysLeft);
  const percentRemaining = Math.max(0, Math.min(100, (daysLeft / totalDays) * 100));
  const endsLabel = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(status.endsAt);

  return (
    <div
      role="status"
      className={cn(
        "border-b px-4 py-3",
        urgent ? "border-destructive/20 bg-destructive/5" : "border-border bg-primary/5",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              "mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0",
              urgent ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
            )}
          >
            {urgent ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-medium leading-snug">
              {daysLeft === 1 ? "1 day left on your free trial" : `${daysLeft} days left on your free trial`}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
              Upgrade to keep using all features.
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between sm:justify-end gap-4">
          <div className="text-right leading-none">
            <div
              className={cn(
                "text-3xl sm:text-4xl font-bold tabular-nums tracking-tight",
                urgent ? "text-destructive" : "text-primary",
              )}
            >
              {daysLeft}
            </div>
            <div className="text-xs text-muted-foreground">{daysLeft === 1 ? "day left" : "days left"}</div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <Progress
          value={percentRemaining}
          className={cn("h-2", urgent ? "bg-destructive/15" : "bg-primary/15")}
          indicatorClassName={urgent ? "bg-destructive" : "bg-primary"}
          aria-label="Free trial time remaining"
        />
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Ends {endsLabel}</span>
          <span>14-day trial</span>
        </div>
      </div>
    </div>
  );
}
