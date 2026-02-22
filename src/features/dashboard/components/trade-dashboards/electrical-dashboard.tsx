import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import PageHeader from "@/features/dashboard/components/page-header";
import {
  computeBaseMetrics,
  computeTechMetrics,
  isLast7Days,
  isLast30Days,
  isToday,
  KpiCard,
  SectionHeader,
} from "@/features/dashboard/components/dashboard-kpi-utils";
import { OpsSnapshot } from "@/features/dashboard/components/overview/ops-snapshot";
import { formatZarFromCents } from "@/lib/money";
import {
  AlertTriangle,
  CheckCircle,
  ClipboardCheck,
  DollarSign,
  Flame,
  Percent,
  Search,
  ShieldCheck,
  Sun,
  TrendingUp,
  Zap,
} from "lucide-react";

type Props = { data: any; allJobs: any[] };

const SOLAR_KEYWORDS = ["solar", "pv", "inverter", "battery", "panel"] as const;

export function isSolarJob(job: any) {
  const hay = `${job?.title ?? ""} ${job?.description ?? ""}`.toLowerCase();
  return SOLAR_KEYWORDS.some((k) => hay.includes(k));
}

export default function ElectricalDashboard({ data, allJobs }: Props) {
  const base = computeBaseMetrics(allJobs, data.technicians);
  const techMetrics = computeTechMetrics(allJobs, data.technicians);

  const jobsToday = allJobs.filter((j) => j.scheduled_at && isToday(j.scheduled_at));
  const emergencyToday = jobsToday.filter((j) => j.priority === "urgent" || j.priority === "emergency");

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

  return (
    <div className="space-y-6">
      <PageHeader title="Electrical Dashboard" subtitle={`${data.company?.name} — Compliance, solar, and job performance`} />

      {/* COMPLIANCE & INSPECTIONS */}
      <div>
        <SectionHeader title="Compliance & Inspections" question="Are certificates and inspections on track?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={ShieldCheck} label="COC Certs Pending" value={cocPending.length} accent={cocPending.length > 0 ? "warning" : undefined} sub="completed jobs awaiting COC" />
          <KpiCard icon={ClipboardCheck} label="Awaiting Inspection" value={awaitingInspection.length} accent={awaitingInspection.length > 0 ? "warning" : undefined} sub="booked / pending" />
          <KpiCard icon={AlertTriangle} label="COC Overdue (30d)" value={cocOverdue30d.length} accent={cocOverdue30d.length > 0 ? "destructive" : undefined} sub="non-compliance = fines" />
          <KpiCard icon={Zap} label="DB Board Upgrades" value={dbBoardJobs.length} sub="this month" />
          <KpiCard icon={Sun} label="Backup Power Jobs" value={loadSheddingJobs.length} sub="UPS / load shedding" />
        </div>
      </div>

      <OpsSnapshot
        title="Operations Snapshot"
        inventoryItems={data.inventoryItems}
        technicians={data.technicians}
        jobs={allJobs}
        sites={data.sites}
        technicianLocations={data.technicianLocations}
        jobTimeEntries={data.jobTimeEntries}
        siteMaterialUsage={data.siteMaterialUsage}
      />

      {/* SOLAR & HIGH-VALUE WORK */}
      <div>
        <SectionHeader title="Solar & High-Value" question="How is solar and project work performing?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={Sun} label="Solar Installs (Month)" value={solarJobs.length} sub={formatZarFromCents(solarRevenue) + " revenue"} />
          <KpiCard icon={DollarSign} label="Avg Revenue / Job" value={formatZarFromCents(base.avgRevenuePerJob)} />
          <KpiCard icon={TrendingUp} label="Revenue (Month)" value={formatZarFromCents(base.revenueThisMonth)} />
          <KpiCard icon={Percent} label="Gross Margin" value={`${base.grossMargin}%`} accent={base.grossMargin < 30 ? "destructive" : undefined}>
            <Progress value={Math.max(0, base.grossMargin)} className="mt-2 h-1.5" />
          </KpiCard>
          <KpiCard icon={Search} label="Quote Conversion (7d)" value={`${quoteConversion}%`} accent={quoteConversion < 50 ? "warning" : undefined} sub={`${openQuotes7d.length} open quotes`} />
        </div>
        {base.callbackJobs.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Electrical rework alert</AlertTitle>
            <AlertDescription>
              {base.callbackJobs.length} callback{base.callbackJobs.length > 1 ? "s" : ""} in 30 days. Rework on electrical = double the labour + compliance risk.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* TODAY'S WORK */}
      <div>
        <SectionHeader title="Today" question="What needs attention right now?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard icon={Flame} label="Emergency Today" value={emergencyToday.length} accent={emergencyToday.length > 0 ? "destructive" : undefined} />
          <KpiCard icon={CheckCircle} label="Jobs Scheduled Today" value={jobsToday.length} />
          <KpiCard icon={Zap} label="In Progress" value={allJobs.filter((j) => j.status === "in-progress").length} />
        </div>
      </div>

      {/* ELECTRICIAN METRICS */}
      <div>
        <SectionHeader title="Electrician Performance" question="Who's delivering and who needs support?" />
        <TechTable techMetrics={techMetrics} />
      </div>
    </div>
  );
}

function TechTable({ techMetrics }: { techMetrics: any[] }) {
  if (techMetrics.length === 0) {
    return <Card className="bg-card/70 backdrop-blur-sm"><CardContent className="py-8 text-center text-muted-foreground text-sm">No active electricians yet.</CardContent></Card>;
  }
  return (
    <Card className="bg-card/70 backdrop-blur-sm">
      <CardContent className="pt-6 space-y-4">
        {techMetrics.map((t) => (
          <div key={t.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.completed} completed · {t.returnVisits} returns</div>
              </div>
              <div className="flex items-center gap-4 text-sm shrink-0">
                <div className="text-center"><div className={`font-bold ${t.firstTimeFix < 80 ? "text-destructive" : ""}`}>{t.firstTimeFix}%</div><div className="text-[10px] text-muted-foreground">Fix rate</div></div>
                <div className="text-center"><div className="font-bold">{formatZarFromCents(t.revenue)}</div><div className="text-[10px] text-muted-foreground">Revenue</div></div>
              </div>
            </div>
            <Separator className="mt-3" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
