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
  Clock,
  DollarSign,
  FileCheck,
  Percent,
  Refrigerator,
  Repeat,
  ShieldAlert,
  Snowflake,
  Thermometer,
  Timer,
  TrendingUp,
} from "lucide-react";

type Props = { data: any; allJobs: any[] };

export default function RefrigerationDashboard({ data, allJobs }: Props) {
  const base = computeBaseMetrics(allJobs, data.technicians);
  const techMetrics = computeTechMetrics(allJobs, data.technicians);

  const jobsToday = allJobs.filter((j) => j.scheduled_at && isToday(j.scheduled_at));
  const emergencyToday = jobsToday.filter((j) => j.priority === "urgent" || j.priority === "emergency");

  /* ── Refrigeration-specific metrics ── */
  const compressorJobs = base.monthJobs.filter((j: any) => {
    const hay = `${j.title ?? ""} ${j.description ?? ""}`.toLowerCase();
    return hay.includes("compressor") || hay.includes("condensing unit");
  });
  const compressorRevenue = compressorJobs.reduce((s: number, j: any) => s + (j.revenue_cents ?? 0), 0);

  const gasRecharges = base.monthJobs.filter((j: any) => {
    const hay = `${j.title ?? ""} ${j.description ?? ""}`.toLowerCase();
    return hay.includes("recharge") || hay.includes("regas") || hay.includes("refrigerant") || hay.includes("gas top");
  });

  const complianceDue = allJobs.filter((j: any) => {
    const notes = String(j.notes ?? "").toLowerCase();
    return notes.includes("compliance") || notes.includes("overdue") || notes.includes("inspection due");
  });

  const maintenanceContracts = allJobs.filter((j: any) => {
    const hay = `${j.title ?? ""} ${j.description ?? ""}`.toLowerCase();
    return hay.includes("maintenance contract") || hay.includes("service agreement") || hay.includes("sla");
  });
  const maintenanceRevenue = maintenanceContracts.reduce((s: number, j: any) => s + (j.revenue_cents ?? 0), 0);

  const breakdownRepeatSites = (() => {
    const siteCounts: Record<string, number> = {};
    allJobs.filter((j: any) => j.site_id && (j.priority === "urgent" || j.priority === "emergency")).forEach((j: any) => {
      siteCounts[j.site_id] = (siteCounts[j.site_id] ?? 0) + 1;
    });
    return Object.values(siteCounts).filter((c) => c >= 2).length;
  })();

  const coldChainJobs = base.monthJobs.filter((j: any) => {
    const hay = `${j.title ?? ""} ${j.description ?? ""} ${j.notes ?? ""}`.toLowerCase();
    return hay.includes("cold room") || hay.includes("cold chain") || hay.includes("walk-in") || hay.includes("freezer room");
  });

  const avgBreakdownResponse = (() => {
    const urgents = allJobs.filter((j: any) =>
      (j.priority === "urgent" || j.priority === "emergency") && j.scheduled_at && j.created_at,
    );
    if (urgents.length === 0) return "—";
    const hrs = urgents.map((j: any) =>
      (new Date(j.scheduled_at).getTime() - new Date(j.created_at).getTime()) / 3_600_000,
    );
    return (hrs.reduce((a: number, b: number) => a + b, 0) / hrs.length).toFixed(1);
  })();

  return (
    <div className="space-y-6">
      <PageHeader title="Refrigeration Dashboard" subtitle={`${data.company?.name} — Cold chain, compliance, and service contracts`} />

      {/* COLD CHAIN & COMPLIANCE */}
      <div>
        <SectionHeader title="Cold Chain & Compliance" question="Are critical units and compliance under control?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={Snowflake} label="Emergency Breakdowns Today" value={emergencyToday.length} accent={emergencyToday.length > 0 ? "destructive" : undefined} sub="cold chain at risk" />
          <KpiCard icon={ShieldAlert} label="Compliance Overdue" value={complianceDue.length} accent={complianceDue.length > 0 ? "destructive" : undefined} sub="inspection / certification" />
          <KpiCard icon={Repeat} label="Repeat Breakdown Sites" value={breakdownRepeatSites} accent={breakdownRepeatSites > 0 ? "warning" : undefined} sub="sites with 2+ emergencies" />
          <KpiCard icon={Timer} label="Breakdown Response" value={`${avgBreakdownResponse}h`} sub="avg emergency response" />
          <KpiCard icon={Refrigerator} label="Cold Room / Walk-in Jobs" value={coldChainJobs.length} sub="this month" />
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

      {/* SERVICE CONTRACTS & REVENUE */}
      <div>
        <SectionHeader title="Service Contracts & Revenue" question="Is recurring revenue growing?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={FileCheck} label="Maintenance Contracts" value={maintenanceContracts.length} sub={formatZarFromCents(maintenanceRevenue) + " revenue"} />
          <KpiCard icon={Refrigerator} label="Compressor Jobs (Month)" value={compressorJobs.length} sub={formatZarFromCents(compressorRevenue) + " high-value"} />
          <KpiCard icon={Thermometer} label="Gas Recharges (Month)" value={gasRecharges.length} sub="track refrigerant costs" />
          <KpiCard icon={DollarSign} label="Revenue (Month)" value={formatZarFromCents(base.revenueThisMonth)} />
          <KpiCard icon={Percent} label="Gross Margin" value={`${base.grossMargin}%`} accent={base.grossMargin < 30 ? "destructive" : undefined}>
            <Progress value={Math.max(0, base.grossMargin)} className="mt-2 h-1.5" />
          </KpiCard>
        </div>
        {base.callbackJobs.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Repeat breakdowns = spoiled stock claims</AlertTitle>
            <AlertDescription>
              {base.callbackJobs.length} callback{base.callbackJobs.length > 1 ? "s" : ""} in 30 days. Refrigeration failures can lead to stock loss claims and liability.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* TODAY */}
      <div>
        <SectionHeader title="Today" question="What's on the schedule?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard icon={Clock} label="Scheduled Today" value={jobsToday.length} />
          <KpiCard icon={TrendingUp} label="In Progress" value={allJobs.filter((j) => j.status === "in-progress").length} />
          <KpiCard icon={Snowflake} label="Avg Revenue / Job" value={formatZarFromCents(base.avgRevenuePerJob)} />
        </div>
      </div>

      {/* TECHNICIAN METRICS */}
      <div>
        <SectionHeader title="Technician Performance" question="Who's keeping cold chains running?" />
        <TechTable techMetrics={techMetrics} />
      </div>
    </div>
  );
}

function TechTable({ techMetrics }: { techMetrics: any[] }) {
  if (techMetrics.length === 0) {
    return <Card className="bg-card/70 backdrop-blur-sm"><CardContent className="py-8 text-center text-muted-foreground text-sm">No active technicians yet.</CardContent></Card>;
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
