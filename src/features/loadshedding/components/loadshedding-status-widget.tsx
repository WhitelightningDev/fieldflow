import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AlertTriangle, Zap, ZapOff } from "lucide-react";
import { Link } from "react-router-dom";
import { useNationalStatus, useAreaSchedule, useLoadsheddingConfig, isJobDuringOutage } from "../hooks/use-loadshedding";

function parseStage(raw: string | undefined): number {
  if (!raw) return 0;
  const match = raw.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export function LoadsheddingStatusWidget({ companyId, jobs }: { companyId?: string | null; jobs?: any[] }) {
  const { status, loading: statusLoading } = useNationalStatus();
  const { config } = useLoadsheddingConfig(companyId);
  const { schedule } = useAreaSchedule(config?.area_id);

  const eskomStage = parseStage(status?.status?.eskom?.stage);
  const cptStage = parseStage(status?.status?.capetown?.stage);
  const activeStage = Math.max(eskomStage, cptStage);

  const upcomingEvents = React.useMemo(() => {
    if (!schedule?.events) return [];
    const now = Date.now();
    return schedule.events.filter((e) => new Date(e.end).getTime() > now).slice(0, 3);
  }, [schedule]);

  const affectedJobs = React.useMemo(() => {
    if (!jobs || !schedule?.events) return [];
    return jobs.filter(
      (j) => j.requires_power && j.status !== "completed" && j.status !== "cancelled" && j.status !== "invoiced"
        && isJobDuringOutage(j.scheduled_at, schedule.events),
    );
  }, [jobs, schedule]);

  if (statusLoading) {
    return (
      <Card className="shadow-sm border-border/40 h-full">
        <CardContent className="flex items-center justify-center py-8">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  const stageColor = activeStage === 0
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : activeStage <= 2
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : activeStage <= 4
        ? "bg-orange-500/10 text-orange-700 dark:text-orange-400"
        : "bg-destructive/10 text-destructive";

  return (
    <Card className="shadow-sm border-border/40 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            {activeStage > 0 ? <ZapOff className="h-4 w-4 text-destructive" /> : <Zap className="h-4 w-4 text-emerald-500" />}
            Load Shedding
          </span>
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs px-2">
            <Link to="/dashboard/loadshedding">View schedule</Link>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">National:</span>
          <Badge className={stageColor}>
            {activeStage === 0 ? "No load shedding" : `Stage ${activeStage}`}
          </Badge>
        </div>

        {config?.area_name && (
          <div className="text-xs text-muted-foreground">
            Area: <span className="font-medium text-foreground">{config.area_name}</span>
          </div>
        )}

        {upcomingEvents.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Upcoming outages:</div>
            {upcomingEvents.map((e, i) => (
              <div key={i} className="text-xs flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1">
                <ZapOff className="h-3 w-3 text-destructive shrink-0" />
                <span>
                  {new Date(e.start).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}{" "}
                  {new Date(e.start).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                  {" – "}
                  {new Date(e.end).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}

        {affectedJobs.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
            <AlertTriangle className="h-3 w-3" />
            {affectedJobs.length} job{affectedJobs.length > 1 ? "s" : ""} scheduled during outages
          </div>
        )}

        {!config && (
          <div className="text-xs text-muted-foreground">
            <Link to="/dashboard/loadshedding" className="text-primary hover:underline">
              Set up your area →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
