import * as React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Clock, AlertTriangle } from "lucide-react";

export default function TrialDaysIconButton({
  daysLeft,
  urgent,
  onClick,
  className,
}: {
  daysLeft: number;
  urgent: boolean;
  onClick: () => void;
  className?: string;
}) {
  const label = daysLeft === 1 ? "1 day left on your free trial" : `${daysLeft} days left on your free trial`;
  const Icon = urgent ? AlertTriangle : Clock;
  const badgeTone = urgent ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("relative h-9 w-9", className)}
          onClick={onClick}
          aria-label={label}
        >
          <Icon className={cn("h-5 w-5", urgent ? "text-destructive" : "text-primary")} />
          <span
            className={cn(
              "absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-[10px] font-semibold tabular-nums flex items-center justify-center shadow-sm",
              badgeTone,
            )}
          >
            {daysLeft}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end">
        {label} — click to show banner
      </TooltipContent>
    </Tooltip>
  );
}

