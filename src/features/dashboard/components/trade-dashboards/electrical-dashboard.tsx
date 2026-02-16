import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import PageHeader from "@/features/dashboard/components/page-header";
import {
  computeBaseMetrics,
  computeTechMetrics,
  isLast7Days,
  isToday,
  KpiCard,
  SectionHeader,
} from "@/features/dashboard/components/dashboard-kpi-utils";
import { OpsSnapshot } from "@/features/dashboard/components/overview/ops-snapshot";
import { formatUsdFromCents } from "@/lib/money";
import {
  AlertTriangle,
  Briefcase,
  Clock,
  DollarSign,
  FileWarning,
  Flame,
  Percent,
  RefreshCcw,
  ShieldCheck,
  Sun,
  TrendingUp,
  Zap,
} from "lucide-react";

type Props = { data: any; allJobs: any[] };

export default function ElectricalDashboard({ data, allJobs }: Props) {
  const base = computeBaseMetrics(allJobs, data.technicians);
  const techMetrics = computeTechMetrics(allJobs, data.technicians);

  const jobsToday = allJobs.filter((j) => j.scheduled_at && isToday(j.scheduled_at));
  const emergencyToday = jobsToday.filter((j) => j.priority === "urgent" || j.priority === "emergency");

  // Electrical-specific
  const solarJobs = base.monthJobs.filter((j: any) => j.title?.toLowerCase().includes("solar") || j.trade_id === "electrical-contracting");
  const cocPending = allJobs.filter((j: any) =>
    j.status === "completed" &&
    (j.title?.toLowerCase().includes("coc") || j.description?.toLowerCase().includes("certificate")),
  );
  const awaitingInspection = allJobs.filter((j: any) =>
    j.notes?.toLowerCase().includes("inspection") || j.notes?.toLowerCase().includes("awaiting inspection"),
  );
  const quotesSent7d = allJobs.filter((j: any) => j.status === "new" && isLast7Days(j.created_at));
  const quoteConversion = (() => {
    const allQuoted = allJobs.filter((j: any) => j.status !== "cancelled");
    const converted = allQuoted.filter((j: any) => j.status !== "new");
    return allQuoted.length > 0 ? Math.round((converted.length / allQuoted.length) * 100) : 0;
  })();

  return (
    <div className="space-y-6">
      <PageHeader title="Electrical Dashboard" subtitle={`${data.company?.name} — Owner Overview`} />

      {/* ACT TODAY */}
      <div>
        <SectionHeader title="Act Today" question="Where do I need to act today?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={Flame} label="Emergency Today" value={emergencyToday.length} accent={emergencyToday.length > 0 ? "destructive" : undefined} />
          <KpiCard icon={Briefcase} label="Jobs Today" value={jobsToday.length} />
          <KpiCard icon={FileWarning} label="Unbilled Jobs" value={base.unbilledJobs.length} accent={base.unbilledJobs.length > 0 ? "destructive" : undefined} sub={formatUsdFromCents(base.unbilledRevenue) + " at risk"} />
          <KpiCard icon={ShieldCheck} label="COC Certs Pending" value={cocPending.length} accent={cocPending.length > 0 ? "warning" : undefined} />
          <KpiCard icon={Clock} label="Awaiting Inspection" value={awaitingInspection.length} accent={awaitingInspection.length > 0 ? "warning" : undefined} />
        </div>
      </div>

      <OpsSnapshot
        title="Operations Snapshot"
        inventoryItems={data.inventoryItems}
        technicians={data.technicians}
        jobs={allJobs}
        sites={data.sites}
      />

      {/* LOSING MONEY */}
      <div>
        <SectionHeader title="Financial" question="Where am I losing money?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={DollarSign} label="Avg Revenue / Job" value={formatUsdFromCents(base.avgRevenuePerJob)} />
          <KpiCard icon={Sun} label="Solar Installs" value={solarJobs.length} sub="this month" />
          <KpiCard icon={TrendingUp} label="Revenue (Month)" value={formatUsdFromCents(base.revenueThisMonth)} />
          <KpiCard icon={Percent} label="Gross Margin" value={`${base.grossMargin}%`} accent={base.grossMargin < 30 ? "destructive" : undefined}>
            <Progress value={Math.max(0, base.grossMargin)} className="mt-2 h-1.5" />
          </KpiCard>
          <KpiCard icon={Zap} label="Quote Conversion" value={`${quoteConversion}%`} accent={quoteConversion < 50 ? "warning" : undefined} sub={`${quotesSent7d.length} open quotes (7d)`} />
        </div>
        {base.callbackJobs.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Rework costing you money</AlertTitle>
            <AlertDescription>
              {base.callbackJobs.length} callback{base.callbackJobs.length > 1 ? "s" : ""} in 30 days. Rework on electrical = double the labour with zero revenue.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* RISK */}
      <div>
        <SectionHeader title="Risk / Compliance" question="Where is risk building?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard icon={RefreshCcw} label="Callbacks (30d)" value={base.callbackJobs.length} accent={base.callbackJobs.length > 0 ? "destructive" : undefined} sub="electrical rework = liability" />
          <KpiCard icon={ShieldCheck} label="COC Certs Due" value={cocPending.length} accent={cocPending.length > 0 ? "warning" : undefined} sub="non-compliance = fines" />
          <KpiCard icon={Clock} label="Avg Response" value={`${base.avgResponseHrs}h`} />
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
                <div className="text-center"><div className="font-bold">{formatUsdFromCents(t.revenue)}</div><div className="text-[10px] text-muted-foreground">Revenue</div></div>
              </div>
            </div>
            <Separator className="mt-3" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
