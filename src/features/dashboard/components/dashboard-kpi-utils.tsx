import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer } from "recharts";

/* ─── Date helpers ─── */
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

/* ─── Surface variants ─── */
export type DashboardSurface = "default" | "subtle" | "warning" | "critical";

const surfaceClasses: Record<DashboardSurface, string> = {
  default: "bg-card border-border shadow-sm",
  subtle: "bg-muted/40 border-border/60 shadow-none",
  warning: "bg-amber-500/5 border-amber-500/30 shadow-sm",
  critical: "bg-destructive/5 border-destructive/30 shadow-sm",
};

/* ─── Density context ─── */
export type DashboardDensity = "compact" | "comfortable";

const DensityContext = React.createContext<{
  density: DashboardDensity;
  setDensity: (d: DashboardDensity) => void;
}>({ density: "comfortable", setDensity: () => {} });

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensity] = React.useState<DashboardDensity>(() => {
    try {
      return (localStorage.getItem("ff-density") as DashboardDensity) || "comfortable";
    } catch {
      return "comfortable";
    }
  });
  const set = React.useCallback((d: DashboardDensity) => {
    setDensity(d);
    try { localStorage.setItem("ff-density", d); } catch {}
  }, []);
  return <DensityContext.Provider value={{ density, setDensity: set }}>{children}</DensityContext.Provider>;
}

export function useDensity() {
  return React.useContext(DensityContext);
}

/* ─── Compute helpers ─── */
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

  const unbilledJobs = allJobs.filter((j: any) => j.status === "completed");
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

/* ─── Chart colors (consistent across app) ─── */
export const CHART_COLORS = {
  profit: "hsl(var(--chart-3))",   // green
  loss: "hsl(var(--destructive))", // red
  neutral: "hsl(var(--chart-1))",  // blue/primary
  accent: "hsl(var(--chart-2))",   // violet
  warn: "hsl(var(--chart-4))",     // amber
} as const;

/* ─── KPI Card (redesigned) ─── */
export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  surface,
  sparkData,
  sparkColor,
  href,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "destructive" | "warning";
  surface?: DashboardSurface;
  sparkData?: number[];
  sparkColor?: string;
  href?: string;
  children?: React.ReactNode;
}) {
  const { density } = useDensity();
  const isCompact = density === "compact";

  const resolvedSurface: DashboardSurface =
    surface ??
    (accent === "destructive" ? "critical" : accent === "warning" ? "warning" : "default");

  const accentClass =
    accent === "destructive"
      ? "text-destructive"
      : accent === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "";

  const sparkPoints = React.useMemo(() => {
    if (!sparkData || sparkData.length < 2) return null;
    return sparkData.map((v, i) => ({ v, i }));
  }, [sparkData]);

  const content = (
    <Card
      className={cn(
        surfaceClasses[resolvedSurface],
        "rounded-xl transition-all duration-200",
        href && "cursor-pointer hover:shadow-md hover:-translate-y-0.5 group",
      )}
      data-tour="kpi-card"
    >
      <CardContent className={cn("relative", isCompact ? "p-3" : "p-4 pt-4")}>
        {/* Icon + label row */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[11px] font-medium uppercase tracking-wider leading-none">{label}</span>
          </div>
          {href && (
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
          )}
        </div>

        {/* Big value */}
        <div className={cn("font-bold tracking-tight", accentClass, isCompact ? "text-xl" : "text-2xl lg:text-3xl")}>
          {value}
        </div>

        {/* Sub text */}
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}

        {/* Sparkline */}
        {sparkPoints && (
          <div className={cn("mt-1", isCompact ? "h-6" : "h-8")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkPoints}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={sparkColor ?? CHART_COLORS.neutral}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {children}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link to={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">{content}</Link>;
  }
  return content;
}

/* ─── KPI Skeleton ─── */
export function KpiCardSkeleton() {
  const { density } = useDensity();
  const isCompact = density === "compact";
  return (
    <Card className="bg-card border-border shadow-sm rounded-xl">
      <CardContent className={cn(isCompact ? "p-3" : "p-4 pt-4")}>
        <Skeleton className="h-3 w-20 mb-2" />
        <Skeleton className={cn(isCompact ? "h-6 w-16" : "h-8 w-24")} />
        <Skeleton className="h-2.5 w-28 mt-1.5" />
      </CardContent>
    </Card>
  );
}

/* ─── Section header (cleaned up) ─── */
export function SectionHeader({ title, question }: { title: string; question: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</h2>
      <p className="text-[11px] text-muted-foreground/70 italic">{question}</p>
    </div>
  );
}

/* ─── Dashboard card skeleton ─── */
export function DashboardCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card className="bg-card border-border shadow-sm rounded-xl">
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ─── Empty state with next-best-action ─── */
export function DashboardEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <Card className="bg-muted/30 border-dashed border-2 border-border/60 rounded-xl">
      <CardContent className="py-10 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="font-medium text-foreground text-sm">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">{description}</div>
        {actionLabel && (actionHref || onAction) && (
          actionHref ? (
            <Link
              to={actionHref}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              {actionLabel} <ArrowRight className="h-3 w-3" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              {actionLabel} <ArrowRight className="h-3 w-3" />
            </button>
          )
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Density toggle (compact / comfortable) ─── */
export function DensityToggle() {
  const { density, setDensity } = useDensity();
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border p-0.5 text-xs">
      <button
        type="button"
        className={cn(
          "rounded-md px-2.5 py-1 font-medium transition-colors",
          density === "compact" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => setDensity("compact")}
      >
        Compact
      </button>
      <button
        type="button"
        className={cn(
          "rounded-md px-2.5 py-1 font-medium transition-colors",
          density === "comfortable" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => setDensity("comfortable")}
      >
        Comfortable
      </button>
    </div>
  );
}
