import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import PageHeader from "@/features/dashboard/components/page-header";
import {
  computeBaseMetrics,
  computeTechMetrics,
  isAfterHours,
  isLast24h,
  isThisMonth,
  isToday,
  KpiCard,
  SectionHeader,
} from "@/features/dashboard/components/dashboard-kpi-utils";
import { OpsSnapshot } from "@/features/dashboard/components/overview/ops-snapshot";
import { formatZarFromCents } from "@/lib/money";
import {
  AlertTriangle,
  Clock,
  DollarSign,
  Droplets,
  FileWarning,
  Flame,
  PackageSearch,
  Percent,
  PhoneCall,
  RefreshCcw,
  ShieldCheck,
  Briefcase,
  TrendingUp,
  Wrench,
} from "lucide-react";

type Props = { data: any; allJobs: any[] };

export default function PlumbingDashboard({ data, allJobs }: Props) {
  const base = computeBaseMetrics(allJobs, data.technicians);
  const techMetrics = computeTechMetrics(allJobs, data.technicians);

  const jobsToday = allJobs.filter((j) => j.scheduled_at && isToday(j.scheduled_at));
  const emergencyToday = jobsToday.filter((j) => j.priority === "urgent" || j.priority === "emergency");
  const leakCallouts24h = allJobs.filter(
    (j) => j.created_at && isLast24h(j.created_at) &&
      (j.title?.toLowerCase().includes("leak") || j.description?.toLowerCase().includes("leak")),
  );
  const awaitingParts = allJobs.filter((j) => j.notes?.toLowerCase().includes("awaiting parts"));
  const waterHeaterJobs = base.monthJobs.filter(
    (j) => j.title?.toLowerCase().includes("water heater") || j.title?.toLowerCase().includes("geyser"),
  );
  const afterHoursRevenue = base.monthJobs
    .filter((j) => j.scheduled_at && isAfterHours(j.scheduled_at))
    .reduce((s: number, j: any) => s + (j.revenue_cents ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Plumbing Dashboard" subtitle={`${data.company?.name} — Owner Overview`} />

      {/* ─── ACT TODAY ─── */}
      <div>
        <SectionHeader title="Act Today" question="Where do I need to act today?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={Flame} label="Emergency Jobs Today" value={emergencyToday.length} accent={emergencyToday.length > 0 ? "destructive" : undefined} />
          <KpiCard icon={Droplets} label="Leak Callouts (24h)" value={leakCallouts24h.length} accent={leakCallouts24h.length > 0 ? "warning" : undefined} />
          <KpiCard icon={Clock} label="Avg Response Time" value={`${base.avgResponseHrs}h`} />
          <KpiCard icon={PackageSearch} label="Awaiting Parts" value={awaitingParts.length} accent={awaitingParts.length > 0 ? "warning" : undefined} />
          <KpiCard icon={FileWarning} label="Unbilled Jobs" value={base.unbilledJobs.length} accent={base.unbilledJobs.length > 0 ? "destructive" : undefined} sub={base.unbilledJobs.length > 0 ? formatZarFromCents(base.unbilledRevenue) + " at risk" : undefined} />
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

      {/* ─── LOSING MONEY ─── */}
      <div>
        <SectionHeader title="Financial" question="Where am I losing money?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={DollarSign} label="Avg Revenue / Job" value={formatZarFromCents(base.avgRevenuePerJob)} />
          <KpiCard icon={Wrench} label="Water Heater Installs" value={waterHeaterJobs.length} sub="this month" />
          <KpiCard icon={TrendingUp} label="Revenue (Month)" value={formatZarFromCents(base.revenueThisMonth)} />
          <KpiCard icon={Percent} label="Gross Margin" value={`${base.grossMargin}%`} accent={base.grossMargin < 30 ? "destructive" : undefined}>
            <Progress value={Math.max(0, base.grossMargin)} className="mt-2 h-1.5" />
          </KpiCard>
          <KpiCard icon={PhoneCall} label="After-Hours Revenue" value={formatZarFromCents(afterHoursRevenue)} />
        </div>
        {base.callbackJobs.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Rework is eroding profit</AlertTitle>
            <AlertDescription>
              {base.callbackJobs.length} callback/rework job{base.callbackJobs.length > 1 ? "s" : ""} in 30 days. Each callback costs you the tech's time + fuel with zero new revenue.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* ─── RISK ─── */}
      <div>
        <SectionHeader title="Risk / Compliance" question="Where is risk building?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard icon={RefreshCcw} label="Callbacks (30d)" value={base.callbackJobs.length} accent={base.callbackJobs.length > 0 ? "destructive" : undefined} sub="rework kills margin" />
          <KpiCard icon={ShieldCheck} label="Gas Compliance Certs" value="—" sub="Track via Service Calls" />
          <KpiCard icon={Briefcase} label="Pressure Tests" value="—" sub="Track via Service Calls" />
        </div>
      </div>

      {/* ─── TECH METRICS ─── */}
      <div>
        <SectionHeader title="Technician Metrics" question="Who's making money and who's costing you?" />
        <TechMetricsTable techMetrics={techMetrics} />
      </div>
    </div>
  );
}

function TechMetricsTable({ techMetrics }: { techMetrics: any[] }) {
  if (techMetrics.length === 0) {
    return (
      <Card className="bg-card/70 backdrop-blur-sm">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">No active technicians yet.</CardContent>
      </Card>
    );
  }
  return (
    <Card className="bg-card/70 backdrop-blur-sm">
      <CardContent className="pt-6 space-y-4">
        {techMetrics.map((tech) => (
          <div key={tech.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{tech.name}</div>
                <div className="text-xs text-muted-foreground">
                  {tech.completed} completed · {tech.returnVisits} returns
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm shrink-0">
                <div className="text-center">
                  <div className={`font-bold ${tech.firstTimeFix < 80 ? "text-destructive" : ""}`}>{tech.firstTimeFix}%</div>
                  <div className="text-[10px] text-muted-foreground">Fix rate</div>
                </div>
                <div className="text-center">
                  <div className="font-bold">{formatZarFromCents(tech.revenue)}</div>
                  <div className="text-[10px] text-muted-foreground">Revenue</div>
                </div>
              </div>
            </div>
            <Separator className="mt-3" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
