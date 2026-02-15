import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import PageHeader from "@/features/dashboard/components/page-header";
import {
  computeBaseMetrics,
  computeTechMetrics,
  isLast30Days,
  isToday,
  KpiCard,
  SectionHeader,
} from "@/features/dashboard/components/dashboard-kpi-utils";
import { formatUsdFromCents } from "@/lib/money";
import {
  AlertTriangle,
  Briefcase,
  Clock,
  DollarSign,
  FileWarning,
  Flame,
  Package,
  Percent,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
  WashingMachine,
} from "lucide-react";

type Props = { data: any; allJobs: any[] };

export default function ApplianceRepairDashboard({ data, allJobs }: Props) {
  const base = computeBaseMetrics(allJobs, data.technicians);
  const techMetrics = computeTechMetrics(allJobs, data.technicians);

  const jobsToday = allJobs.filter((j) => j.scheduled_at && isToday(j.scheduled_at));
  const emergencyToday = jobsToday.filter((j) => j.priority === "urgent" || j.priority === "emergency");

  // Appliance-specific
  const warrantyJobs = allJobs.filter((j: any) =>
    j.title?.toLowerCase().includes("warranty") || j.notes?.toLowerCase().includes("warranty"),
  );
  const warrantyJobsMonth = warrantyJobs.filter((j: any) => isLast30Days(j.created_at));
  const partsWaiting = allJobs.filter((j: any) => j.notes?.toLowerCase().includes("awaiting parts") || j.notes?.toLowerCase().includes("back order"));
  const repeatCustomers = (() => {
    const custCounts: Record<string, number> = {};
    allJobs.filter((j: any) => j.customer_id).forEach((j: any) => {
      custCounts[j.customer_id] = (custCounts[j.customer_id] ?? 0) + 1;
    });
    return Object.values(custCounts).filter((c) => c >= 2).length;
  })();
  const avgPartsPerJob = (() => {
    // estimate from material usage or notes
    const jobsWithParts = allJobs.filter((j: any) => j.notes?.toLowerCase().includes("parts"));
    return base.completedMonthJobs.length > 0 ? (jobsWithParts.length / base.completedMonthJobs.length * 100).toFixed(0) : "0";
  })();

  return (
    <div className="space-y-6">
      <PageHeader title="Appliance Repair Dashboard" subtitle={`${data.company?.name} — Owner Overview`} />

      {/* ACT TODAY */}
      <div>
        <SectionHeader title="Act Today" question="Where do I need to act today?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={Flame} label="Urgent Today" value={emergencyToday.length} accent={emergencyToday.length > 0 ? "destructive" : undefined} />
          <KpiCard icon={Briefcase} label="Jobs Today" value={jobsToday.length} />
          <KpiCard icon={FileWarning} label="Unbilled Jobs" value={base.unbilledJobs.length} accent={base.unbilledJobs.length > 0 ? "destructive" : undefined} sub={formatUsdFromCents(base.unbilledRevenue) + " at risk"} />
          <KpiCard icon={Package} label="Awaiting Parts" value={partsWaiting.length} accent={partsWaiting.length > 0 ? "warning" : undefined} sub="delayed = lost customer" />
          <KpiCard icon={ShieldCheck} label="Warranty Claims (30d)" value={warrantyJobsMonth.length} accent={warrantyJobsMonth.length > 3 ? "warning" : undefined} />
        </div>
      </div>

      {/* LOSING MONEY */}
      <div>
        <SectionHeader title="Financial" question="Where am I losing money?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={DollarSign} label="Avg Revenue / Job" value={formatUsdFromCents(base.avgRevenuePerJob)} />
          <KpiCard icon={WashingMachine} label="Warranty Jobs" value={warrantyJobs.length} sub="often zero-margin" />
          <KpiCard icon={TrendingUp} label="Revenue (Month)" value={formatUsdFromCents(base.revenueThisMonth)} />
          <KpiCard icon={Percent} label="Gross Margin" value={`${base.grossMargin}%`} accent={base.grossMargin < 30 ? "destructive" : undefined}>
            <Progress value={Math.max(0, base.grossMargin)} className="mt-2 h-1.5" />
          </KpiCard>
          <KpiCard icon={RefreshCcw} label="Repeat Customers" value={repeatCustomers} sub="upsell opportunity" />
        </div>
        {base.callbackJobs.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Rework eating margins</AlertTitle>
            <AlertDescription>
              {base.callbackJobs.length} callback{base.callbackJobs.length > 1 ? "s" : ""} in 30 days. Appliance callbacks = parts + labour on your dime. Check if techs are diagnosing correctly first time.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* RISK */}
      <div>
        <SectionHeader title="Risk" question="Where is risk building?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard icon={RefreshCcw} label="Callbacks (30d)" value={base.callbackJobs.length} accent={base.callbackJobs.length > 0 ? "destructive" : undefined} sub="wrong diagnosis = double cost" />
          <KpiCard icon={Clock} label="Avg Response" value={`${base.avgResponseHrs}h`} sub="speed = repeat business" />
          <KpiCard icon={Package} label="Parts Back-ordered" value={partsWaiting.length} accent={partsWaiting.length > 0 ? "warning" : undefined} sub="every day = lost revenue" />
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
