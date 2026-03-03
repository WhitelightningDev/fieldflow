import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  computeBaseMetrics,
  computeTechMetrics,
  isLast7Days,
  isLast30Days,
  isToday,
  DensityToggle,
  useDensity,
} from "@/features/dashboard/components/dashboard-kpi-utils";
import { OpsSnapshot } from "@/features/dashboard/components/overview/ops-snapshot";
import { JobsDonutChart } from "@/features/dashboard/components/overview/jobs-donut-chart";
import { InvoiceOverviewCard } from "@/features/dashboard/components/overview/invoice-overview-card";
import { RecentJobsCard } from "@/features/dashboard/components/overview/recent-jobs-card";
import { OpenTicketsCard } from "@/features/dashboard/components/overview/open-tickets-card";
import { formatZarFromCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle,
  ClipboardCheck,
  DollarSign,
  Flame,
  Percent,
  Search,
  ShieldCheck,
  Sun,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import * as React from "react";

type Props = { data: any; allJobs: any[] };

const SOLAR_KEYWORDS = ["solar", "pv", "inverter", "battery", "panel"] as const;

export function isSolarJob(job: any) {
  const hay = `${job?.title ?? ""} ${job?.description ?? ""}`.toLowerCase();
  return SOLAR_KEYWORDS.some((k) => hay.includes(k));
}

/* ─── Quick stat pill (Panze-style) ─── */
function QuickStat({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "destructive" | "warning" | "success";
  href?: string;
}) {
  const iconColor =
    accent === "destructive"
      ? "text-destructive bg-destructive/10"
      : accent === "warning"
        ? "text-[hsl(38_92%_50%)] bg-[hsl(38_92%_50%/0.1)]"
        : accent === "success"
          ? "text-[hsl(142_71%_45%)] bg-[hsl(142_71%_45%/0.1)]"
          : "text-primary bg-primary/10";

  const content = (
    <div className={cn(
      "flex items-center gap-2.5 sm:gap-3 rounded-xl border border-border/30 bg-card p-2.5 sm:p-3 shadow-sm transition-all",
      href && "hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
    )}>
      <div className={cn("h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center shrink-0", iconColor)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium truncate">{label}</p>
        <p className="text-sm sm:text-base font-bold text-foreground leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground hidden sm:block">{sub}</p>}
      </div>
    </div>
  );

  if (href) return <Link to={href} className="block">{content}</Link>;
  return content;
}

export default function ElectricalDashboard({ data, allJobs }: Props) {
  const base = computeBaseMetrics(allJobs, data.technicians);
  const techMetrics = computeTechMetrics(allJobs, data.technicians);

  const jobsToday = allJobs.filter((j) => j.scheduled_at && isToday(j.scheduled_at));
  const emergencyToday = jobsToday.filter((j) => j.priority === "urgent" || j.priority === "emergency");
  const activeTechs = data.technicians.filter((t: any) => t.active).length;

  /* ── Electrical-specific metrics ── */
  const solarJobs = base.monthJobs.filter(isSolarJob);
  const solarRevenue = solarJobs.reduce((s: number, j: any) => s + (j.revenue_cents ?? 0), 0);

  const cocPending = allJobs.filter((j: any) => {
    if (j.status !== "completed") return false;
    const hay = `${j.title ?? ""} ${j.description ?? ""}`.toLowerCase();
    return hay.includes("coc") || hay.includes("certificate");
  });

  const awaitingInspection = allJobs.filter((j: any) => {
    const notes = String(j.notes ?? "").toLowerCase();
    return notes.includes("awaiting inspection") || notes.includes("inspection pending") || notes.includes("inspection booked");
  });

  const dbBoardJobs = base.monthJobs.filter((j: any) => {
    const hay = `${j.title ?? ""} ${j.description ?? ""}`.toLowerCase();
    return hay.includes("db board") || hay.includes("distribution board") || hay.includes("consumer unit");
  });

  const quotesWindow7d = allJobs.filter((j: any) => j.created_at && isLast7Days(j.created_at) && j.status !== "cancelled");
  const openQuotes7d = quotesWindow7d.filter((j: any) => j.status === "new");
  const quoteConversion = quotesWindow7d.length === 0 ? 0 : Math.round(((quotesWindow7d.length - openQuotes7d.length) / quotesWindow7d.length) * 100);

  const loadSheddingJobs = base.monthJobs.filter((j: any) => {
    const hay = `${j.title ?? ""} ${j.description ?? ""} ${j.notes ?? ""}`.toLowerCase();
    return hay.includes("load shedding") || hay.includes("loadshedding") || hay.includes("ups") || hay.includes("backup power");
  });

  const cocOverdue30d = allJobs.filter((j: any) => {
    if (j.status === "invoiced" || j.status === "cancelled") return false;
    const hay = `${j.title ?? ""} ${j.description ?? ""}`.toLowerCase();
    return (hay.includes("coc") || hay.includes("certificate")) && j.created_at && isLast30Days(j.created_at);
  });

  // Job status segments for donut
  const jobSegments = React.useMemo(() => {
    const statusMap: Record<string, number> = {};
    for (const j of allJobs) statusMap[j.status] = (statusMap[j.status] ?? 0) + 1;
    return [
      { label: "In Progress", count: statusMap["in-progress"] ?? 0, color: "hsl(var(--chart-1))" },
      { label: "Completed", count: (statusMap["completed"] ?? 0) + (statusMap["invoiced"] ?? 0), color: "hsl(var(--chart-3))" },
      { label: "Scheduled", count: statusMap["scheduled"] ?? 0, color: "hsl(var(--chart-4))" },
      { label: "New", count: statusMap["new"] ?? 0, color: "hsl(var(--chart-2))" },
    ].filter((s) => s.count > 0);
  }, [allJobs]);

  // Attention items
  const attentionItems = React.useMemo(() => {
    const items: any[] = [];
    if (emergencyToday.length > 0) items.push({ id: "emergency", name: `${emergencyToday.length} Emergency jobs today`, message: "Urgent dispatch required", severity: "critical", href: "/dashboard/jobs" });
    if (cocPending.length > 0) items.push({ id: "coc", name: `${cocPending.length} COC certs pending`, message: "Completed jobs awaiting certificates", severity: "warning", href: "/dashboard/coc-certificates" });
    if (cocOverdue30d.length > 0) items.push({ id: "cocoverdue", name: `${cocOverdue30d.length} COC overdue (30d)`, message: "Non-compliance = fines", severity: "critical", href: "/dashboard/jobs" });
    if (base.unbilledJobs.length > 0) items.push({ id: "unbilled", name: `${base.unbilledJobs.length} Unbilled jobs`, message: `${formatZarFromCents(base.unbilledRevenue)} at risk`, severity: "warning", href: "/dashboard/invoices" });
    if (awaitingInspection.length > 0) items.push({ id: "inspection", name: `${awaitingInspection.length} Awaiting inspection`, message: "Booked or pending inspections", severity: "info", href: "/dashboard/jobs" });
    if (base.callbackJobs.length > 0) items.push({ id: "callbacks", name: `${base.callbackJobs.length} Callbacks (30d)`, message: "Rework on electrical = compliance risk", severity: "critical", href: "/dashboard/jobs" });
    return items;
  }, [emergencyToday, cocPending, cocOverdue30d, base, awaitingInspection]);

  const today = format(new Date(), "EEEE, MMMM d, yyyy");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Manage and track your operations
          </p>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-foreground mt-0.5 truncate">
            Electrical Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            {today}
          </div>
          <DensityToggle />
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <QuickStat icon={Flame} label="Emergency" value={emergencyToday.length} accent={emergencyToday.length > 0 ? "destructive" : undefined} href="/dashboard/jobs" />
        <QuickStat icon={ShieldCheck} label="COC Pending" value={cocPending.length} accent={cocPending.length > 0 ? "warning" : undefined} href="/dashboard/coc-certificates" />
        <QuickStat icon={Sun} label="Solar Jobs" value={solarJobs.length} sub={formatZarFromCents(solarRevenue)} href="/dashboard/jobs" />
        <QuickStat icon={Users} label="Active Techs" value={activeTechs} sub={`${data.technicians.length} total`} href="/dashboard/technicians" />
        <QuickStat icon={DollarSign} label="Revenue (Month)" value={formatZarFromCents(base.revenueThisMonth)} accent="success" href="/dashboard/invoices" />
      </div>

      {/* Main 3-column Panze layout */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left — Jobs donut + Compliance */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="shadow-sm border-border/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
                <span>Jobs Overview</span>
                <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <Link to="/dashboard/jobs"><ArrowUpRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <JobsDonutChart segments={jobSegments} />
            </CardContent>
          </Card>

          {/* Compliance summary */}
          <Card className="shadow-sm border-border/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Compliance & Inspections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "COC Certs Pending", value: cocPending.length, icon: ShieldCheck, warn: cocPending.length > 0 },
                { label: "Awaiting Inspection", value: awaitingInspection.length, icon: ClipboardCheck, warn: awaitingInspection.length > 0 },
                { label: "COC Overdue (30d)", value: cocOverdue30d.length, icon: AlertTriangle, warn: cocOverdue30d.length > 0 },
                { label: "DB Board Upgrades", value: dbBoardJobs.length, icon: Zap, warn: false },
                { label: "Backup Power", value: loadSheddingJobs.length, icon: Sun, warn: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                      item.warn ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                    )}>
                      <item.icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                  <Badge variant={item.warn ? "destructive" : "secondary"} className="text-xs font-semibold">
                    {item.value}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Center — Invoice overview + Financial */}
        <div className="lg:col-span-4 space-y-4">
          <InvoiceOverviewCard invoices={data.invoices ?? []} />

          <Card className="shadow-sm border-border/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Financial Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Avg Revenue / Job</span>
                <span className="text-sm font-semibold">{formatZarFromCents(base.avgRevenuePerJob)}</span>
              </div>
              <Separator className="opacity-40" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Gross Margin</span>
                <span className={cn("text-sm font-semibold", base.grossMargin < 30 ? "text-destructive" : "")}>{base.grossMargin}%</span>
              </div>
              <Progress value={Math.max(0, base.grossMargin)} className="h-1.5" />
              <Separator className="opacity-40" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Unbilled Revenue</span>
                <span className="text-sm font-semibold text-destructive">{formatZarFromCents(base.unbilledRevenue)}</span>
              </div>
              <Separator className="opacity-40" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Quote Conversion (7d)</span>
                <Badge variant={quoteConversion < 50 ? "destructive" : "secondary"}>{quoteConversion}%</Badge>
              </div>
              <Separator className="opacity-40" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Callbacks (30d)</span>
                <Badge variant={base.callbackJobs.length > 0 ? "destructive" : "secondary"}>{base.callbackJobs.length}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right — Attention + Recent */}
        <div className="lg:col-span-4 space-y-4">
          <OpenTicketsCard items={attentionItems} />
          <RecentJobsCard jobs={allJobs} technicians={data.technicians} />
        </div>
      </div>

      {/* Callback alert */}
      {base.callbackJobs.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Electrical rework alert</AlertTitle>
          <AlertDescription>
            {base.callbackJobs.length} callback{base.callbackJobs.length > 1 ? "s" : ""} in 30 days. Rework on electrical = double the labour + compliance risk.
          </AlertDescription>
        </Alert>
      )}

      {/* Full-width operations */}
      <OpsSnapshot
        title="Operations"
        inventoryItems={data.inventoryItems}
        technicians={data.technicians}
        jobs={allJobs}
        sites={data.sites}
        technicianLocations={data.technicianLocations}
        jobTimeEntries={data.jobTimeEntries}
        siteMaterialUsage={data.siteMaterialUsage}
      />

      {/* Electrician Performance */}
      <div>
        <div className="mb-3 flex items-center gap-2.5">
          <div className="w-1 h-5 rounded-full gradient-bg" />
          <h2 className="text-sm font-semibold text-foreground">Electrician Performance</h2>
          <p className="text-xs text-muted-foreground">Who's delivering and who needs support?</p>
        </div>
        <TechTable techMetrics={techMetrics} />
      </div>
    </div>
  );
}

function TechTable({ techMetrics }: { techMetrics: any[] }) {
  if (techMetrics.length === 0) {
    return (
      <Card className="shadow-sm border-border/30">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">No active electricians yet.</CardContent>
      </Card>
    );
  }
  return (
    <Card className="shadow-sm border-border/30">
      <CardContent className="pt-6 space-y-0">
        {techMetrics.map((t, idx) => (
          <React.Fragment key={t.id}>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{t.name}</div>
                  <div className="text-[10px] text-muted-foreground">{t.completed} completed · {t.returnVisits} returns</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm shrink-0">
                <div className="text-center">
                  <div className={cn("font-bold text-xs", t.firstTimeFix < 80 ? "text-destructive" : "text-foreground")}>{t.firstTimeFix}%</div>
                  <div className="text-[9px] text-muted-foreground">Fix rate</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-xs">{formatZarFromCents(t.revenue)}</div>
                  <div className="text-[9px] text-muted-foreground">Revenue</div>
                </div>
              </div>
            </div>
            {idx < techMetrics.length - 1 && <Separator className="opacity-30" />}
          </React.Fragment>
        ))}
      </CardContent>
    </Card>
  );
}
