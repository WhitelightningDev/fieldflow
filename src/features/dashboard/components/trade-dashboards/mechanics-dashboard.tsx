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
import { formatUsdFromCents } from "@/lib/money";
import {
  AlertTriangle,
  Briefcase,
  Car,
  Clock,
  DollarSign,
  FileWarning,
  Flame,
  MapPin,
  Package,
  Percent,
  RefreshCcw,
  TrendingUp,
} from "lucide-react";

type Props = { data: any; allJobs: any[] };

export default function MobileMechanicsDashboard({ data, allJobs }: Props) {
  const base = computeBaseMetrics(allJobs, data.technicians);
  const techMetrics = computeTechMetrics(allJobs, data.technicians);

  const jobsToday = allJobs.filter((j) => j.scheduled_at && isToday(j.scheduled_at));
  const emergencyToday = jobsToday.filter((j) => j.priority === "urgent" || j.priority === "emergency");

  // Mechanic-specific
  const roadside = allJobs.filter((j: any) => j.title?.toLowerCase().includes("roadside") || j.description?.toLowerCase().includes("roadside"));
  const diagnosticOnly = base.monthJobs.filter((j: any) =>
    j.title?.toLowerCase().includes("diagnostic") || j.title?.toLowerCase().includes("inspection"),
  );
  const partsWaiting = allJobs.filter((j: any) => j.notes?.toLowerCase().includes("awaiting parts") || j.notes?.toLowerCase().includes("back order"));
  const noShowJobs = allJobs.filter((j: any) => j.notes?.toLowerCase().includes("no show") || j.notes?.toLowerCase().includes("no-show"));

  // Jobs with no site = potentially wasted travel
  const noSiteJobs = allJobs.filter((j: any) => !j.site_id && j.status !== "cancelled");

  return (
    <div className="space-y-6">
      <PageHeader title="Mobile Mechanics Dashboard" subtitle={`${data.company?.name} — Owner Overview`} />

      {/* ACT TODAY */}
      <div>
        <SectionHeader title="Act Today" question="Where do I need to act today?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={Flame} label="Emergency Callouts" value={emergencyToday.length} accent={emergencyToday.length > 0 ? "destructive" : undefined} />
          <KpiCard icon={Briefcase} label="Jobs Today" value={jobsToday.length} />
          <KpiCard icon={FileWarning} label="Unbilled Jobs" value={base.unbilledJobs.length} accent={base.unbilledJobs.length > 0 ? "destructive" : undefined} sub={formatUsdFromCents(base.unbilledRevenue) + " at risk"} />
          <KpiCard icon={Package} label="Awaiting Parts" value={partsWaiting.length} accent={partsWaiting.length > 0 ? "warning" : undefined} />
          <KpiCard icon={MapPin} label="No Location Set" value={noSiteJobs.length} accent={noSiteJobs.length > 0 ? "warning" : undefined} sub="wasted travel risk" />
        </div>
      </div>

      {/* LOSING MONEY */}
      <div>
        <SectionHeader title="Financial" question="Where am I losing money?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={DollarSign} label="Avg Revenue / Job" value={formatUsdFromCents(base.avgRevenuePerJob)} />
          <KpiCard icon={Car} label="Roadside Calls" value={roadside.length} sub="high urgency, price accordingly" />
          <KpiCard icon={TrendingUp} label="Revenue (Month)" value={formatUsdFromCents(base.revenueThisMonth)} />
          <KpiCard icon={Percent} label="Gross Margin" value={`${base.grossMargin}%`} accent={base.grossMargin < 30 ? "destructive" : undefined}>
            <Progress value={Math.max(0, base.grossMargin)} className="mt-2 h-1.5" />
          </KpiCard>
          <KpiCard icon={Clock} label="Diagnostic-Only Jobs" value={diagnosticOnly.length} sub="upsell opportunity" />
        </div>
        {noShowJobs.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No-shows are burning time</AlertTitle>
            <AlertDescription>
              {noShowJobs.length} no-show job{noShowJobs.length > 1 ? "s" : ""} recorded. Each no-show = fuel + hours wasted. Consider deposits for bookings.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* RISK */}
      <div>
        <SectionHeader title="Risk" question="Where is risk building?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard icon={RefreshCcw} label="Callbacks (30d)" value={base.callbackJobs.length} accent={base.callbackJobs.length > 0 ? "destructive" : undefined} sub="repeat visits = lost profit" />
          <KpiCard icon={Clock} label="Avg Response" value={`${base.avgResponseHrs}h`} sub="speed wins mobile jobs" />
          <KpiCard icon={Package} label="Parts Back-ordered" value={partsWaiting.length} accent={partsWaiting.length > 0 ? "warning" : undefined} sub="delayed = unhappy customer" />
        </div>
      </div>

      {/* TECH METRICS */}
      <div>
        <SectionHeader title="Mechanic Metrics" question="Who's making money and who's costing you?" />
        <TechTable techMetrics={techMetrics} label="mechanics" />
      </div>
    </div>
  );
}

function TechTable({ techMetrics, label }: { techMetrics: any[]; label: string }) {
  if (techMetrics.length === 0) {
    return <Card className="bg-card/70 backdrop-blur-sm"><CardContent className="py-8 text-center text-muted-foreground text-sm">No active {label} yet.</CardContent></Card>;
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
