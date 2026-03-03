import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, LayoutGrid, List } from "lucide-react";
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
  default: "bg-card border-border/50",
  subtle: "bg-muted/30 border-border/40",
  warning: "bg-card border-border/50",
  critical: "bg-card border-border/50",
};

/* Accent strip colors for left border */
const accentStrip: Record<DashboardSurface, string> = {
  default: "border-l-primary/60",
  subtle: "border-l-muted-foreground/30",
  warning: "border-l-[hsl(38_92%_50%)]",
  critical: "border-l-destructive",
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
  profit: "hsl(var(--chart-3))",
  loss: "hsl(var(--destructive))",
  neutral: "hsl(var(--chart-1))",
  accent: "hsl(var(--chart-2))",
  warn: "hsl(var(--chart-4))",
} as const;

/* ─── KPI Card (Yellowfin-inspired) ─── */
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
  trend,
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
  trend?: { value: string; positive?: boolean };
}) {
  const { density } = useDensity();
  const isCompact = density === "compact";

  const resolvedSurface: DashboardSurface =
    surface ??
    (accent === "destructive" ? "critical" : accent === "warning" ? "warning" : "default");

  const iconBg =
    accent === "destructive"
      ? "bg-destructive/10 text-destructive"
      : accent === "warning"
        ? "bg-[hsl(38_92%_50%/0.1)] text-[hsl(38_92%_40%)] dark:text-[hsl(38_92%_65%)]"
        : "bg-primary/10 text-primary";

  const sparkPoints = React.useMemo(() => {
    if (!sparkData || sparkData.length < 2) return null;
    return sparkData.map((v, i) => ({ v, i }));
  }, [sparkData]);

  const content = (
    <div
      className={cn(
        "rounded-xl border border-l-[3px] shadow-sm transition-all duration-200 overflow-hidden",
        surfaceClasses[resolvedSurface],
        accentStrip[resolvedSurface],
        href && "cursor-pointer hover:shadow-md hover:-translate-y-0.5 group",
      )}
      data-tour="kpi-card"
    >
      <div className={cn("relative", isCompact ? "p-3" : "px-5 py-4")}>
        {/* Top row: icon + label + trend */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2.5">
            <div className={cn("rounded-lg p-1.5", iconBg)}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
          </div>
          {trend && (
            <span className={cn(
              "text-[11px] font-semibold px-1.5 py-0.5 rounded",
              trend.positive ? "bg-[hsl(142_71%_45%/0.1)] text-[hsl(142_71%_35%)] dark:text-[hsl(142_71%_60%)]" : "bg-destructive/10 text-destructive",
            )}>
              {trend.value}
            </span>
          )}
          {!trend && href && (
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
          )}
        </div>

        {/* Value */}
        <div className={cn(
          "font-bold tracking-tight text-foreground",
          isCompact ? "text-2xl" : "text-3xl",
        )}>
          {value}
        </div>

        {/* Sub text */}
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}

        {/* Sparkline */}
        {sparkPoints && (
          <div className={cn("mt-2", isCompact ? "h-7" : "h-9")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkPoints}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={sparkColor ?? CHART_COLORS.neutral}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {children}
      </div>
    </div>
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
    <div className="rounded-xl border border-l-[3px] border-l-muted-foreground/20 bg-card shadow-sm">
      <div className={cn(isCompact ? "p-3" : "px-5 py-4")}>
        <div className="flex items-center gap-2.5 mb-2">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className={cn(isCompact ? "h-7 w-20" : "h-9 w-28")} />
        <Skeleton className="h-2.5 w-24 mt-2" />
      </div>
    </div>
  );
}

/* ─── Section header (Yellowfin-style with colored accent bar) ─── */
export function SectionHeader({ title, question }: { title: string; question: string }) {
  return (
    <div className="mb-4 flex items-end gap-3">
      <div className="flex items-center gap-2.5">
        <div className="w-1 h-5 rounded-full gradient-bg" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <p className="text-xs text-muted-foreground">{question}</p>
    </div>
  );
}

/* ─── Dashboard card skeleton ─── */
export function DashboardCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card className="bg-card border-border/50 shadow-sm rounded-xl">
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
    <div className="rounded-xl border-2 border-dashed border-border/50 bg-muted/20">
      <div className="py-8 text-center px-4">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
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
      </div>
    </div>
  );
}

/* ─── Density toggle (Yellowfin-style icon toggle) ─── */
export function DensityToggle() {
  const { density, setDensity } = useDensity();
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border/50 bg-muted/30 p-0.5">
      <button
        type="button"
        className={cn(
          "rounded-md p-1.5 transition-colors",
          density === "compact" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => setDensity("compact")}
        title="Compact"
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={cn(
          "rounded-md p-1.5 transition-colors",
          density === "comfortable" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => setDensity("comfortable")}
        title="Comfortable"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
