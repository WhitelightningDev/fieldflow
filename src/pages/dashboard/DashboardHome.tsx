import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { isTradeId, type TradeId } from "@/features/company-signup/content/trades";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardSelectors } from "@/features/dashboard/hooks/use-dashboard-selectors";
import { useInventoryAlerts } from "@/features/dashboard/hooks/use-inventory-alerts";
import { useTradeFilter } from "@/features/dashboard/hooks/use-trade-filter";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
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
  CalendarClock,
  DollarSign,
  FileWarning,
  Flame,
  PackageSearch,
  Percent,
  RefreshCcw,
  TrendingUp,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

/* ─── Trade-specific dashboard imports ─── */
import PlumbingDashboard from "@/features/dashboard/components/trade-dashboards/plumbing-dashboard";
import ElectricalDashboard from "@/features/dashboard/components/trade-dashboards/electrical-dashboard";
import MobileMechanicsDashboard from "@/features/dashboard/components/trade-dashboards/mechanics-dashboard";
import RefrigerationDashboard from "@/features/dashboard/components/trade-dashboards/refrigeration-dashboard";
import ApplianceRepairDashboard from "@/features/dashboard/components/trade-dashboards/appliance-dashboard";

/* ─── Fallback generic dashboard ─── */
function GenericDashboard({ data, allJobs }: { data: any; allJobs: any[] }) {
  const base = computeBaseMetrics(allJobs, data.technicians);
  const techMetrics = computeTechMetrics(allJobs, data.technicians);
  const { lowStock, expiringSoon } = useInventoryAlerts(data.inventoryItems);

  const jobsToday = allJobs.filter((j) => j.scheduled_at && isToday(j.scheduled_at));
  const emergencyToday = jobsToday.filter((j) => j.priority === "urgent" || j.priority === "emergency");

  return (
    <div className="space-y-6">
      <PageHeader title="Owner Dashboard" subtitle={`${data.company?.name} — Overview`} />

      {/* ACT TODAY */}
      <div>
        <SectionHeader title="Act Today" question="Where do I need to act today?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={Flame} label="Emergency Today" value={emergencyToday.length} accent={emergencyToday.length > 0 ? "destructive" : undefined} />
          <KpiCard icon={Briefcase} label="Jobs Today" value={jobsToday.length} />
          <KpiCard icon={FileWarning} label="Unbilled Jobs" value={base.unbilledJobs.length} accent={base.unbilledJobs.length > 0 ? "destructive" : undefined} sub={formatUsdFromCents(base.unbilledRevenue) + " at risk"} />
          <KpiCard icon={PackageSearch} label="Low Stock Items" value={lowStock.length} accent={lowStock.length > 0 ? "warning" : undefined} />
          <KpiCard icon={Users} label="Active Techs" value={data.technicians.filter((t: any) => t.active).length} sub={`${data.technicians.length} total`} />
        </div>
      </div>

      {/* LOSING MONEY */}
      <div>
        <SectionHeader title="Financial" question="Where am I losing money?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={DollarSign} label="Avg Revenue / Job" value={formatUsdFromCents(base.avgRevenuePerJob)} />
          <KpiCard icon={TrendingUp} label="Revenue (Month)" value={formatUsdFromCents(base.revenueThisMonth)} />
          <KpiCard icon={Percent} label="Gross Margin" value={`${base.grossMargin}%`} accent={base.grossMargin < 30 ? "destructive" : undefined}>
            <Progress value={Math.max(0, base.grossMargin)} className="mt-2 h-1.5" />
          </KpiCard>
          <KpiCard icon={RefreshCcw} label="Callbacks (30d)" value={base.callbackJobs.length} accent={base.callbackJobs.length > 0 ? "destructive" : undefined} sub="rework erodes profit" />
          <KpiCard icon={FileWarning} label="Unbilled Revenue" value={formatUsdFromCents(base.unbilledRevenue)} accent={base.unbilledRevenue > 0 ? "warning" : undefined} />
        </div>
        {base.callbackJobs.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Rework alert</AlertTitle>
            <AlertDescription>
              {base.callbackJobs.length} callback{base.callbackJobs.length > 1 ? "s" : ""} in 30 days. Each callback = tech time + fuel with zero new revenue.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* RISK */}
      <div>
        <SectionHeader title="Risk" question="Where is risk building?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard icon={RefreshCcw} label="Return Visits (30d)" value={base.callbackJobs.length} accent={base.callbackJobs.length > 0 ? "destructive" : undefined} />
          <KpiCard icon={CalendarClock} label="Expiring Stock" value={expiringSoon.length} accent={expiringSoon.length > 0 ? "warning" : undefined} />
          <KpiCard icon={PackageSearch} label="Below Reorder" value={lowStock.length} accent={lowStock.length > 0 ? "warning" : undefined} />
        </div>
      </div>

      {/* TECH METRICS */}
      <div>
        <SectionHeader title="Technician Metrics" question="Who's making money and who's costing you?" />
        {techMetrics.length === 0 ? (
          <Card className="bg-card/70 backdrop-blur-sm">
            <CardContent className="py-8 text-center text-muted-foreground text-sm">No active technicians yet.</CardContent>
          </Card>
        ) : (
          <Card className="bg-card/70 backdrop-blur-sm">
            <CardContent className="pt-6 space-y-4">
              {techMetrics.map((tech) => (
                <div key={tech.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{tech.name}</div>
                      <div className="text-xs text-muted-foreground">{tech.completed} completed · {tech.returnVisits} returns</div>
                    </div>
                    <div className="flex items-center gap-4 text-sm shrink-0">
                      <div className="text-center">
                        <div className={`font-bold ${tech.firstTimeFix < 80 ? "text-destructive" : ""}`}>{tech.firstTimeFix}%</div>
                        <div className="text-[10px] text-muted-foreground">Fix rate</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold">{formatUsdFromCents(tech.revenue)}</div>
                        <div className="text-[10px] text-muted-foreground">Revenue</div>
                      </div>
                    </div>
                  </div>
                  <Separator className="mt-3" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ─── Main export: routes to trade-specific dashboard ─── */
export default function DashboardHome() {
  const { data, loading } = useDashboardData();
  const allowedTradeIds: TradeId[] | null =
    data.company?.industry && isTradeId(data.company.industry) ? [data.company.industry] : null;
  const { trade } = useTradeFilter(allowedTradeIds);
  const selectors = useDashboardSelectors(data, trade);
  const allJobs = selectors.jobCards;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data.company) {
    return (
      <div className="space-y-6">
        <PageHeader title="Overview" subtitle="Set up your company to start using the dashboard." />
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">No company yet</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Create your company to unlock job cards, inventory, teams, and sites.
            </div>
            <Button asChild className="gradient-bg hover:opacity-90 shadow-glow">
              <Link to="/dashboard/create-company">Create company</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const props = { data, allJobs };

  switch (data.company.industry) {
    case "plumbing":
      return <PlumbingDashboard {...props} />;
    case "electrical-contracting":
      return <ElectricalDashboard {...props} />;
    case "mobile-mechanics":
      return <MobileMechanicsDashboard {...props} />;
    case "refrigeration":
      return <RefrigerationDashboard {...props} />;
    case "appliance-repair":
      return <ApplianceRepairDashboard {...props} />;
    default:
      return <GenericDashboard {...props} />;
  }
}
