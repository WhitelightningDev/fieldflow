import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, AlertTriangle } from "lucide-react";
import type { TrialStatus } from "../hooks/use-trial-status";

export default function TrialBanner({ status }: { status: TrialStatus }) {
  if (status.state !== "trialing") return null;

  const urgent = status.daysLeft <= 3;

  return (
    <Alert variant={urgent ? "destructive" : "default"} className="mx-4 mt-2">
      {urgent ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
      <AlertDescription className="flex items-center gap-2 text-sm">
        <span className="font-medium">
          {status.daysLeft === 1
            ? "1 day left on your free trial"
            : `${status.daysLeft} days left on your free trial`}
        </span>
        <span className="text-muted-foreground">— Upgrade to keep using all features.</span>
      </AlertDescription>
    </Alert>
  );
}
