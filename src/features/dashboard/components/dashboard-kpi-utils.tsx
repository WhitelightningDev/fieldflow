import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { LucideIcon } from "lucide-react";
import * as React from "react";

export function isToday(dateStr: string) {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

export function isLast24h(dateStr: string) {
  return Date.now() - new Date(dateStr).getTime() < 86_400_000;
}

export function isThisMonth(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export function isLast30Days(dateStr: string) {
  return Date.now() - new Date(dateStr).getTime() < 30 * 86_400_000;
}

export function isLast7Days(dateStr: string) {
  return Date.now() - new Date(dateStr).getTime() < 7 * 86_400_000;
}

export function isAfterHours(dateStr: string) {
  const h = new Date(dateStr).getHours();
  return h < 7 || h >= 18;
}

/** Compute common metrics from jobs + technicians */
export function computeBaseMetrics(allJobs: any[], technicians: any[]) {
  const monthJobs = allJobs.filter((j) => isThisMonth(j.updated_at));
  const revenueThisMonth = monthJobs.reduce((s: number, j: any) => s + (j.revenue_cents ?? 0), 0);
  const completedMonthJobs = monthJobs.filter((j: any) => j.status === "invoiced" || j.status === "completed");
  const avgRevenuePerJob = completedMonthJobs.length > 0 ? Math.round(revenueThisMonth / completedMonthJobs.length) : 0;

  const totalLabourCost = technicians.reduce((sum: number, t: any) => {
    const techJobs = monthJobs.filter((j: any) => j.technician_id === t.id);
    const hours = techJobs.length * 2;
    return sum + hours * (t.hourly_cost_cents ?? 0);
  }, 0);

  const grossMargin = revenueThisMonth > 0
    ? Math.round(((revenueThisMonth - totalLabourCost) / revenueThisMonth) * 100)
    : 0;

  const unbilledJobs = allJobs.filter((j: any) => j.status === "completed"); // completed but not invoiced
  const unbilledRevenue = unbilledJobs.reduce((s: number, j: any) => s + (j.revenue_cents ?? 0), 0);

  const callbackJobs = allJobs.filter(
    (j: any) =>
      isLast30Days(j.created_at) &&
      (j.notes?.toLowerCase().includes("callback") ||
        j.notes?.toLowerCase().includes("rework") ||
        j.notes?.toLowerCase().includes("return")),
  );

  const avgResponseHrs = (() => {
    const times = allJobs
      .filter((j: any) => j.scheduled_at && j.created_at)
      .map((j: any) => (new Date(j.scheduled_at).getTime() - new Date(j.created_at).getTime()) / 3_600_000);
    return times.length > 0 ? (times.reduce((a: number, b: number) => a + b, 0) / times.length).toFixed(1) : "—";
  })();

  return {
    monthJobs,
    revenueThisMonth,
    completedMonthJobs,
    avgRevenuePerJob,
    totalLabourCost,
    grossMargin,
    unbilledJobs,
    unbilledRevenue,
    callbackJobs,
    avgResponseHrs,
  };
}

/** Compute per-technician metrics */
export function computeTechMetrics(allJobs: any[], technicians: any[]) {
  return technicians
    .filter((t: any) => t.active)
    .map((t: any) => {
      const techJobs = allJobs.filter((j: any) => j.technician_id === t.id);
      const completed = techJobs.filter((j: any) => j.status === "completed" || j.status === "invoiced").length;
      const returnVisits = techJobs.filter(
        (j: any) =>
          j.notes?.toLowerCase().includes("callback") ||
          j.notes?.toLowerCase().includes("return") ||
          j.notes?.toLowerCase().includes("rework"),
      ).length;
      const firstTimeFix = completed > 0 ? Math.round(((completed - returnVisits) / completed) * 100) : 0;
      const revenue = techJobs.reduce((s: number, j: any) => s + (j.revenue_cents ?? 0), 0);
      const active = techJobs.filter((j: any) => j.status === "in-progress").length;
      return { ...t, completed, returnVisits, firstTimeFix, revenue, active, total: techJobs.length };
    })
    .sort((a: any, b: any) => b.revenue - a.revenue);
}

/* ─── Reusable KPI Card ─── */
export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "destructive" | "warning";
  children?: React.ReactNode;
}) {
  const accentClass =
    accent === "destructive"
      ? "text-destructive"
      : accent === "warning"
        ? "text-amber-600"
        : "";
  return (
    <Card className="bg-card/70 backdrop-blur-sm" data-tour="kpi-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" /> {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${accentClass}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        {children}
      </CardContent>
    </Card>
  );
}

/* ─── Section header ─── */
export function SectionHeader({ title, question }: { title: string; question: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h2>
      <p className="text-xs text-muted-foreground italic">{question}</p>
    </div>
  );
}
