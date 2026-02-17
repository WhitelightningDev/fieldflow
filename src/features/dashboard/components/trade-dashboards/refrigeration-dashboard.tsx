import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import PageHeader from "@/features/dashboard/components/page-header";
import {
  computeBaseMetrics,
  computeTechMetrics,
  isToday,
  KpiCard,
  SectionHeader,
} from "@/features/dashboard/components/dashboard-kpi-utils";
import { OpsSnapshot } from "@/features/dashboard/components/overview/ops-snapshot";
import { formatZarFromCents } from "@/lib/money";
import {
  AlertTriangle,
  Briefcase,
  Clock,
  DollarSign,
  FileWarning,
  Flame,
  Percent,
  Refrigerator,
  RefreshCcw,
  ShieldCheck,
  Thermometer,
  TrendingUp,
} from "lucide-react";

type Props = { data: any; allJobs: any[] };

export default function RefrigerationDashboard({ data, allJobs }: Props) {
  const base = computeBaseMetrics(allJobs, data.technicians);
  const techMetrics = computeTechMetrics(allJobs, data.technicians);

  const jobsToday = allJobs.filter((j) => j.scheduled_at && isToday(j.scheduled_at));
  const emergencyToday = jobsToday.filter((j) => j.priority === "urgent" || j.priority === "emergency");

  // Refrigeration-specific
  const compressorJobs = base.monthJobs.filter((j: any) => j.title?.toLowerCase().includes("compressor"));
  const gasRecharges = base.monthJobs.filter((j: any) =>
    j.title?.toLowerCase().includes("recharge") || j.title?.toLowerCase().includes("regas") || j.title?.toLowerCase().includes("gas"),
  );
  const maintenanceContracts = allJobs.filter((j: any) =>
    j.title?.toLowerCase().includes("maintenance") || j.title?.toLowerCase().includes("service contract"),
  );
  const complianceDue = allJobs.filter((j: any) =>
    j.notes?.toLowerCase().includes("compliance") || j.notes?.toLowerCase().includes("overdue"),
  );
  const breakdownRepeatSites = (() => {
    const siteCounts: Record<string, number> = {};
    allJobs.filter((j: any) => j.site_id && (j.priority === "urgent" || j.priority === "emergency")).forEach((j: any) => {
      siteCounts[j.site_id] = (siteCounts[j.site_id] ?? 0) + 1;
    });
    return Object.values(siteCounts).filter((c) => c >= 2).length;
  })();

  return (
    <div className="space-y-6">
      <PageHeader title="Refrigeration Dashboard" subtitle={`${data.company?.name} — Owner Overview`} />

      {/* ACT TODAY */}
      <div>
        <SectionHeader title="Act Today" question="Where do I need to act today?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={Flame} label="Emergency Breakdowns" value={emergencyToday.length} accent={emergencyToday.length > 0 ? "destructive" : undefined} />
          <KpiCard icon={Briefcase} label="Jobs Today" value={jobsToday.length} />
          <KpiCard icon={FileWarning} label="Unbilled Jobs" value={base.unbilledJobs.length} accent={base.unbilledJobs.length > 0 ? "destructive" : undefined} sub={formatZarFromCents(base.unbilledRevenue) + " at risk"} />
          <KpiCard icon={ShieldCheck} label="Compliance Due" value={complianceDue.length} accent={complianceDue.length > 0 ? "destructive" : undefined} />
          <KpiCard icon={Clock} label="Avg Response" value={`${base.avgResponseHrs}h`} sub="cold chain = urgency" />
        </div>
      </div>

      <OpsSnapshot
        title="Operations Snapshot"
        inventoryItems={data.inventoryItems}
        technicians={data.technicians}
        jobs={allJobs}
        sites={data.sites}
        technicianLocations={data.technicianLocations}
      />

      {/* LOSING MONEY */}
      <div>
        <SectionHeader title="Financial" question="Where am I losing money?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={DollarSign} label="Avg Revenue / Job" value={formatZarFromCents(base.avgRevenuePerJob)} />
          <KpiCard icon={Refrigerator} label="Compressor Jobs" value={compressorJobs.length} sub="high-value this month" />
          <KpiCard icon={TrendingUp} label="Revenue (Month)" value={formatZarFromCents(base.revenueThisMonth)} />
          <KpiCard icon={Percent} label="Gross Margin" value={`${base.grossMargin}%`} accent={base.grossMargin < 30 ? "destructive" : undefined}>
            <Progress value={Math.max(0, base.grossMargin)} className="mt-2 h-1.5" />
          </KpiCard>
          <KpiCard icon={Thermometer} label="Gas Recharges" value={gasRecharges.length} sub="track refrigerant costs" />
        </div>
        {base.callbackJobs.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Repeat breakdowns are expensive</AlertTitle>
            <AlertDescription>
              {base.callbackJobs.length} callback{base.callbackJobs.length > 1 ? "s" : ""} in 30 days. Refrigeration callbacks = spoiled stock claims + liability.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* RISK */}
      <div>
        <SectionHeader title="Risk / Compliance" question="Where is risk building?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard icon={RefreshCcw} label="Callbacks (30d)" value={base.callbackJobs.length} accent={base.callbackJobs.length > 0 ? "destructive" : undefined} sub="breakdown = stock loss claim" />
          <KpiCard icon={Refrigerator} label="Repeat Breakdown Sites" value={breakdownRepeatSites} accent={breakdownRepeatSites > 0 ? "warning" : undefined} sub="sites with 2+ emergencies" />
          <KpiCard icon={Briefcase} label="Maintenance Contracts" value={maintenanceContracts.length} sub="recurring revenue base" />
        </div>
      </div>

      {/* TECH METRICS */}
      <div>
        <SectionHeader title="Technician Metrics" question="Who's making money and who's costing you?" />
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
