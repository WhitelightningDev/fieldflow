import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatZarFromCents } from "@/lib/money";
import { isThisMonth, isLast7Days, isLast30Days } from "@/features/dashboard/components/dashboard-kpi-utils";
import { TrendingUp, Users, Clock, Heart } from "lucide-react";
import * as React from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";

type Job = { status: string; updated_at: string; revenue_cents?: number | null; technician_id?: string | null; scheduled_at?: string | null; created_at: string; notes?: string | null };
type Tech = { id: string; name: string; active: boolean };

/* ─── Revenue Trend Widget ─── */
export function RevenueTrendWidget({ jobs }: { jobs: Job[] }) {
  const weeklyData = React.useMemo(() => {
    const weeks: Record<string, number> = {};
    for (const j of jobs) {
      if (!j.revenue_cents || j.revenue_cents <= 0) continue;
      const d = new Date(j.updated_at);
      const weekStart = new Date(d);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      weeks[key] = (weeks[key] ?? 0) + j.revenue_cents;
    }
    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([w, v]) => ({ w, v: v / 100 }));
  }, [jobs]);

  const totalMonth = React.useMemo(
    () => jobs.filter((j) => isThisMonth(j.updated_at)).reduce((s, j) => s + (j.revenue_cents ?? 0), 0),
    [jobs],
  );

  return (
    <Card className="shadow-sm border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[hsl(142_71%_45%/0.1)] flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-[hsl(142_71%_45%)]" />
          </div>
          Revenue Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatZarFromCents(totalMonth)}</div>
        <div className="text-xs text-muted-foreground">This month</div>
        {weeklyData.length >= 2 && (
          <div className="h-16 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData}>
                <Line type="monotone" dataKey="v" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Technician Utilization Widget ─── */
export function TechUtilizationWidget({ jobs, technicians }: { jobs: Job[]; technicians: Tech[] }) {
  const rows = React.useMemo(() => {
    const activeTechs = technicians.filter((t) => t.active);
    return activeTechs.map((t) => {
      const techJobs = jobs.filter((j) => j.technician_id === t.id && isThisMonth(j.updated_at));
      const completed = techJobs.filter((j) => j.status === "completed" || j.status === "invoiced").length;
      const active = techJobs.filter((j) => j.status === "in-progress").length;
      return { name: t.name, completed, active, total: techJobs.length };
    }).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [jobs, technicians]);

  const maxJobs = Math.max(...rows.map((r) => r.total), 1);

  return (
    <Card className="shadow-sm border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-4 w-4 text-primary" />
          </div>
          Technician Utilization
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active technicians</p>
        ) : (
          rows.map((r) => (
            <div key={r.name} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium truncate">{r.name}</span>
                <span className="text-muted-foreground">{r.total} jobs</span>
              </div>
              <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all"
                  style={{ width: `${(r.total / maxJobs) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/* ─── SLA Compliance Widget ─── */
export function SlaComplianceWidget({ jobs }: { jobs: Job[] }) {
  const stats = React.useMemo(() => {
    const recent = jobs.filter((j) => isLast30Days(j.created_at));
    const withSchedule = recent.filter((j) => j.scheduled_at && j.created_at);
    let within24h = 0;
    let within48h = 0;
    for (const j of withSchedule) {
      const diff = new Date(j.scheduled_at!).getTime() - new Date(j.created_at).getTime();
      const hrs = diff / 3_600_000;
      if (hrs <= 24) within24h++;
      if (hrs <= 48) within48h++;
    }
    const rate24 = withSchedule.length > 0 ? Math.round((within24h / withSchedule.length) * 100) : 0;
    const rate48 = withSchedule.length > 0 ? Math.round((within48h / withSchedule.length) * 100) : 0;
    return { total: recent.length, scheduled: withSchedule.length, rate24, rate48 };
  }, [jobs]);

  return (
    <Card className="shadow-sm border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[hsl(38_92%_50%/0.1)] flex items-center justify-center">
            <Clock className="h-4 w-4 text-[hsl(38_92%_50%)]" />
          </div>
          SLA Compliance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold">{stats.rate24}%</div>
            <div className="text-xs text-muted-foreground">Within 24h</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.rate48}%</div>
            <div className="text-xs text-muted-foreground">Within 48h</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Based on {stats.scheduled} scheduled jobs (last 30 days)
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Customer Satisfaction Widget ─── */
export function CustomerSatisfactionWidget({ jobs }: { jobs: Job[] }) {
  const stats = React.useMemo(() => {
    const monthJobs = jobs.filter((j) => isThisMonth(j.updated_at));
    const completed = monthJobs.filter((j) => j.status === "completed" || j.status === "invoiced");
    const callbacks = completed.filter(
      (j) => j.notes?.toLowerCase().match(/callback|return|rework|complaint/),
    );
    const satisfactionRate = completed.length > 0
      ? Math.round(((completed.length - callbacks.length) / completed.length) * 100)
      : 100;
    return {
      completed: completed.length,
      callbacks: callbacks.length,
      rate: satisfactionRate,
    };
  }, [jobs]);

  const rateColor = stats.rate >= 90
    ? "text-[hsl(142_71%_45%)]"
    : stats.rate >= 70
      ? "text-[hsl(38_92%_50%)]"
      : "text-destructive";

  return (
    <Card className="shadow-sm border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[hsl(var(--chart-2)/0.1)] flex items-center justify-center">
            <Heart className="h-4 w-4 text-[hsl(var(--chart-2))]" />
          </div>
          Customer Satisfaction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={cn("text-3xl font-bold", rateColor)}>{stats.rate}%</div>
        <div className="text-xs text-muted-foreground">
          {stats.completed} jobs completed · {stats.callbacks} callbacks this month
        </div>
        <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", stats.rate >= 90 ? "bg-[hsl(142_71%_45%)]" : stats.rate >= 70 ? "bg-[hsl(38_92%_50%)]" : "bg-destructive")}
            style={{ width: `${stats.rate}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
