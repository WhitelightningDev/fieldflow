import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import PageHeader from "@/features/dashboard/components/page-header";
import {
  computeBaseMetrics,
  computeTechMetrics,
  isToday,
  isLast30Days,
  KpiCard,
  SectionHeader,
} from "@/features/dashboard/components/dashboard-kpi-utils";
import { OpsSnapshot } from "@/features/dashboard/components/overview/ops-snapshot";
import { formatZarFromCents } from "@/lib/money";
import {
  AlertTriangle,
  Car,
  Clock,
  DollarSign,
  Fuel,
  Gauge,
  MapPin,
  Navigation,
  Percent,
  TrendingUp,
  UserX,
  Wrench,
} from "lucide-react";

type Props = { data: any; allJobs: any[] };

export default function MobileMechanicsDashboard({ data, allJobs }: Props) {
  const base = computeBaseMetrics(allJobs, data.technicians);
  const techMetrics = computeTechMetrics(allJobs, data.technicians);

  const jobsToday = allJobs.filter((j) => j.scheduled_at && isToday(j.scheduled_at));

  /* ── Mechanics-specific metrics ── */
  const roadsideAssists = allJobs.filter((j: any) => {
    const hay = `${j.title ?? ""} ${j.description ?? ""}`.toLowerCase();
    return hay.includes("roadside") || hay.includes("breakdown") || hay.includes("stranded");
  });
  const roadsideToday = roadsideAssists.filter((j) => j.scheduled_at && isToday(j.scheduled_at));

  const diagnosticJobs = base.monthJobs.filter((j: any) => {
    const hay = `${j.title ?? ""} ${j.description ?? ""}`.toLowerCase();
    return hay.includes("diagnostic") || hay.includes("scan") || hay.includes("fault find");
  });
  const diagnosticRevenue = diagnosticJobs.reduce((s: number, j: any) => s + (j.revenue_cents ?? 0), 0);

  const noShowJobs = allJobs.filter((j: any) => {
    const notes = String(j.notes ?? "").toLowerCase();
    return notes.includes("no show") || notes.includes("no-show") || notes.includes("noshow");
  });

  const noSiteJobs = allJobs.filter((j: any) => !j.site_id && j.status !== "cancelled" && j.status !== "invoiced");

  const fleetJobs = base.monthJobs.filter((j: any) => {
    const hay = `${j.title ?? ""} ${j.description ?? ""} ${j.notes ?? ""}`.toLowerCase();
    return hay.includes("fleet") || hay.includes("company vehicle") || hay.includes("contract");
  });

  const serviceJobs = base.monthJobs.filter((j: any) => {
    const hay = `${j.title ?? ""} ${j.description ?? ""}`.toLowerCase();
    return hay.includes("service") || hay.includes("oil change") || hay.includes("routine");
  });

  const avgJobsPerMechanic = (() => {
    const active = (data.technicians ?? []).filter((t: any) => t.active);
    if (active.length === 0) return 0;
    return Math.round(base.monthJobs.length / active.length);
  })();

  return (
    <div className="space-y-6">
      <PageHeader title="Mobile Mechanics Dashboard" subtitle={`${data.company?.name} — Roadside, diagnostics, and fleet performance`} />

      {/* ROADSIDE & DISPATCH */}
      <div>
        <SectionHeader title="Roadside & Dispatch" question="How is mobile response performing?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={Car} label="Roadside Assists Today" value={roadsideToday.length} accent={roadsideToday.length > 0 ? "destructive" : undefined} sub="high-urgency callouts" />
          <KpiCard icon={Navigation} label="Jobs Without Location" value={noSiteJobs.length} accent={noSiteJobs.length > 3 ? "warning" : undefined} sub="wasted travel risk" />
          <KpiCard icon={UserX} label="No-Shows (All Time)" value={noShowJobs.length} accent={noShowJobs.length > 0 ? "warning" : undefined} sub="fuel + hours wasted" />
          <KpiCard icon={Clock} label="Avg Response Time" value={`${base.avgResponseHrs}h`} sub="speed wins roadside jobs" />
          <KpiCard icon={Gauge} label="Jobs / Mechanic (Month)" value={avgJobsPerMechanic} sub="workload distribution" />
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

      {/* DIAGNOSTICS & FLEET */}
      <div>
        <SectionHeader title="Diagnostics & Fleet" question="Are diagnostics converting and fleet contracts profitable?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={Wrench} label="Diagnostic Jobs (Month)" value={diagnosticJobs.length} sub={formatZarFromCents(diagnosticRevenue) + " revenue"} />
          <KpiCard icon={Fuel} label="Fleet / Contract Jobs" value={fleetJobs.length} sub="recurring mobile work" />
          <KpiCard icon={Car} label="Routine Services (Month)" value={serviceJobs.length} sub="oil changes, filters, etc." />
          <KpiCard icon={DollarSign} label="Avg Revenue / Job" value={formatZarFromCents(base.avgRevenuePerJob)} />
          <KpiCard icon={TrendingUp} label="Revenue (Month)" value={formatZarFromCents(base.revenueThisMonth)} />
        </div>
        {noShowJobs.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No-shows are burning fuel and time</AlertTitle>
            <AlertDescription>
              {noShowJobs.length} no-show{noShowJobs.length > 1 ? "s" : ""} recorded. Each no-show = travel cost + lost slot. Consider deposits for bookings.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* PROFITABILITY */}
      <div>
        <SectionHeader title="Profitability" question="Is mobile work covering travel costs?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard icon={Percent} label="Gross Margin" value={`${base.grossMargin}%`} accent={base.grossMargin < 30 ? "destructive" : undefined}>
            <Progress value={Math.max(0, base.grossMargin)} className="mt-2 h-1.5" />
          </KpiCard>
          <KpiCard icon={MapPin} label="Total Roadside Calls" value={roadsideAssists.length} sub="price accordingly for urgency" />
          <KpiCard icon={Car} label="Scheduled Today" value={jobsToday.length} sub="today's route" />
        </div>
      </div>

      {/* MECHANIC METRICS */}
      <div>
        <SectionHeader title="Mechanic Performance" question="Who's covering ground and who's falling behind?" />
        <TechTable techMetrics={techMetrics} />
      </div>
    </div>
  );
}

function TechTable({ techMetrics }: { techMetrics: any[] }) {
  if (techMetrics.length === 0) {
    return <Card className="bg-card/70 backdrop-blur-sm"><CardContent className="py-8 text-center text-muted-foreground text-sm">No active mechanics yet.</CardContent></Card>;
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
