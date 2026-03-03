import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { isTradeId, type TradeId } from "@/features/company-signup/content/trades";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardSelectors } from "@/features/dashboard/hooks/use-dashboard-selectors";
import { useInventoryAlerts } from "@/features/dashboard/hooks/use-inventory-alerts";
import { useTradeFilter } from "@/features/dashboard/hooks/use-trade-filter";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import {
  CHART_COLORS,
  computeBaseMetrics,
  DashboardEmptyState,
  DensityProvider,
  DensityToggle,
  isLast7Days,
  isToday,
  KpiCard,
  KpiCardSkeleton,
  SectionHeader,
  useDensity,
} from "@/features/dashboard/components/dashboard-kpi-utils";
import { OpsSnapshot } from "@/features/dashboard/components/overview/ops-snapshot";
import { AiInsightsCard } from "@/features/dashboard/components/overview/ai-insights-card";
import { formatZarFromCents } from "@/lib/money";
import {
  AlertTriangle,
  Briefcase,
  CalendarClock,
  Clock,
  DollarSign,
  FileWarning,
  Flame,
  PackageSearch,
  Percent,
  RefreshCcw,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import NoCompanyStateCard from "@/features/dashboard/components/no-company-state-card";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

/* ─── Trade-specific dashboard imports ─── */
import PlumbingDashboard from "@/features/dashboard/components/trade-dashboards/plumbing-dashboard";
import ElectricalDashboard from "@/features/dashboard/components/trade-dashboards/electrical-dashboard";
import MobileMechanicsDashboard from "@/features/dashboard/components/trade-dashboards/mechanics-dashboard";
import RefrigerationDashboard from "@/features/dashboard/components/trade-dashboards/refrigeration-dashboard";
import ApplianceRepairDashboard from "@/features/dashboard/components/trade-dashboards/appliance-dashboard";
import * as React from "react";

/* ─── Build 7-day sparkline from jobs ─── */
function useSparkline(allJobs: any[], field: "scheduled_at" | "updated_at", filter?: (j: any) => boolean) {
  return React.useMemo(() => {
    const days = Array(7).fill(0);
    const now = Date.now();
    for (const j of allJobs) {
      if (filter && !filter(j)) continue;
      const d = j[field];
      if (!d) continue;
      const age = now - new Date(d).getTime();
      const idx = 6 - Math.floor(age / 86_400_000);
      if (idx >= 0 && idx < 7) days[idx]++;
    }
    return days;
  }, [allJobs, field, filter]);
}

/* ─── Dashboard greeting ─── */
function DashboardGreeting({ companyName }: { companyName?: string }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{greeting}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {companyName && <span className="font-medium text-foreground">{companyName}</span>}
          {companyName && " · "}
          {today}
        </p>
      </div>
      <DensityToggle />
    </div>
  );
}

/* ─── Fallback generic dashboard ─── */
function GenericDashboard({ data, allJobs }: { data: any; allJobs: any[] }) {
  const base = computeBaseMetrics(allJobs, data.technicians);
  const { lowStock, expiringSoon } = useInventoryAlerts(data.inventoryItems);
  const { density } = useDensity();

  const jobsToday = allJobs.filter((j) => j.scheduled_at && isToday(j.scheduled_at));
  const emergencyToday = jobsToday.filter((j) => j.priority === "urgent" || j.priority === "emergency");

  const jobsSpark = useSparkline(allJobs, "scheduled_at");
  const emergSpark = useSparkline(allJobs, "scheduled_at", (j) => j.priority === "urgent" || j.priority === "emergency");
  const revenueSpark = useSparkline(allJobs, "updated_at", (j) => j.status === "invoiced" || j.status === "completed");

  const activeTechs = data.technicians.filter((t: any) => t.active).length;

  // Calculate trends
  const last7Jobs = allJobs.filter((j) => j.scheduled_at && isLast7Days(j.scheduled_at)).length;
  const prev7Jobs = allJobs.filter((j) => {
    if (!j.scheduled_at) return false;
    const age = Date.now() - new Date(j.scheduled_at).getTime();
    return age >= 7 * 86_400_000 && age < 14 * 86_400_000;
  }).length;
  const jobTrend = prev7Jobs > 0 ? Math.round(((last7Jobs - prev7Jobs) / prev7Jobs) * 100) : 0;

  return (
    <div className="space-y-8">
      <DashboardGreeting companyName={data.company?.name} />

      {/* AI Insights */}
      <AiInsightsCard data={data} />

      {/* AT-A-GLANCE */}
      <div>
        <SectionHeader title="At a Glance" question="Key metrics for today" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            icon={Flame}
            label="Emergency"
            value={emergencyToday.length}
            accent={emergencyToday.length > 0 ? "destructive" : undefined}
            sparkData={emergSpark}
            sparkColor={CHART_COLORS.loss}
            href="/dashboard/jobs"
          />
          <KpiCard
            icon={Briefcase}
            label="Jobs Today"
            value={jobsToday.length}
            sparkData={jobsSpark}
            sparkColor={CHART_COLORS.neutral}
            href="/dashboard/jobs"
            trend={jobTrend !== 0 ? { value: `${jobTrend > 0 ? "+" : ""}${jobTrend}%`, positive: jobTrend > 0 } : undefined}
          />
          <KpiCard
            icon={FileWarning}
            label="Unbilled"
            value={base.unbilledJobs.length}
            accent={base.unbilledJobs.length > 0 ? "destructive" : undefined}
            sub={formatZarFromCents(base.unbilledRevenue) + " at risk"}
            href="/dashboard/invoices"
          />
          <KpiCard
            icon={PackageSearch}
            label="Low Stock"
            value={lowStock.length}
            accent={lowStock.length > 0 ? "warning" : undefined}
            sub={expiringSoon.length > 0 ? `${expiringSoon.length} expiring soon` : undefined}
            href="/dashboard/inventory"
          />
          {activeTechs > 0 ? (
            <KpiCard
              icon={Users}
              label="Active Techs"
              value={activeTechs}
              sub={`${data.technicians.length} total`}
              href="/dashboard/technicians"
            />
          ) : (
            <DashboardEmptyState
              icon={UserPlus}
              title="No technicians"
              description="Add your first technician to start dispatching."
              actionLabel="Add technician"
              actionHref="/dashboard/technicians"
            />
          )}
        </div>
      </div>

      {/* OPERATIONS SNAPSHOT */}
      <OpsSnapshot
        title="Operations"
        inventoryItems={data.inventoryItems}
        technicians={data.technicians}
        jobs={allJobs}
        sites={data.sites}
        technicianLocations={data.technicianLocations}
        jobTimeEntries={data.jobTimeEntries}
        siteMaterialUsage={data.siteMaterialUsage}
        labourOverheadPercent={(() => {
          const raw: any = (data.company as any)?.labour_overhead_percent;
          const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
          return Number.isFinite(n) ? n : undefined;
        })()}
      />

      {/* FINANCIAL */}
      <div>
        <SectionHeader title="Financial" question="Revenue & profitability" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            icon={DollarSign}
            label="Avg / Job"
            value={formatZarFromCents(base.avgRevenuePerJob)}
            href="/dashboard/invoices"
          />
          <KpiCard
            icon={TrendingUp}
            label="Revenue (Month)"
            value={formatZarFromCents(base.revenueThisMonth)}
            sparkData={revenueSpark}
            sparkColor={CHART_COLORS.profit}
            href="/dashboard/invoices"
          />
          <KpiCard
            icon={Percent}
            label="Gross Margin"
            value={`${base.grossMargin}%`}
            accent={base.grossMargin < 30 ? "destructive" : undefined}
          >
            <Progress value={Math.max(0, base.grossMargin)} className="mt-2 h-1.5" />
          </KpiCard>
          <KpiCard
            icon={RefreshCcw}
            label="Callbacks (30d)"
            value={base.callbackJobs.length}
            accent={base.callbackJobs.length > 0 ? "destructive" : undefined}
            sub="rework erodes profit"
            href="/dashboard/jobs"
          />
          <KpiCard
            icon={Clock}
            label="Avg Response"
            value={`${base.avgResponseHrs}h`}
            sub="created → scheduled"
          />
        </div>
        {base.callbackJobs.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Rework alert</AlertTitle>
            <AlertDescription>
              {base.callbackJobs.length} callback{base.callbackJobs.length > 1 ? "s" : ""} in 30 days.
              Each callback = tech time + fuel with zero new revenue.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* RISK */}
      <div>
        <SectionHeader title="Risk" question="Where is risk building?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            icon={RefreshCcw}
            label="Return Visits"
            value={base.callbackJobs.length}
            accent={base.callbackJobs.length > 0 ? "destructive" : undefined}
            href="/dashboard/jobs"
          />
          <KpiCard
            icon={CalendarClock}
            label="Expiring Stock"
            value={expiringSoon.length}
            accent={expiringSoon.length > 0 ? "warning" : undefined}
            href="/dashboard/inventory"
          />
          <KpiCard
            icon={PackageSearch}
            label="Below Reorder"
            value={lowStock.length}
            accent={lowStock.length > 0 ? "warning" : undefined}
            href="/dashboard/inventory"
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Loading skeleton ─── */
function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-64 rounded bg-muted animate-pulse" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)}
      </div>
    </div>
  );
}

/* ─── Main export ─── */
export default function DashboardHome() {
  const { data, loading, companyState, actions } = useDashboardData();
  const { roles, refreshProfile, signOut } = useAuth();
  const canCreateCompany = roles.includes("owner") || roles.includes("admin");

  const retryLink = async () => {
    await refreshProfile();
    await actions.refreshData({ silent: true });
  };
  const allowedTradeIds: TradeId[] | null =
    data.company?.industry && isTradeId(data.company.industry) ? [data.company.industry] : null;
  const { trade } = useTradeFilter(allowedTradeIds);
  const selectors = useDashboardSelectors(data, trade);
  const allJobs = selectors.jobCards;

  if (loading) {
    return (
      <DensityProvider>
        <DashboardSkeleton />
      </DensityProvider>
    );
  }

  if (companyState.kind === "error") {
    const status = companyState.status ? ` (HTTP ${companyState.status})` : "";
    return (
      <div className="space-y-6">
        <PageHeader title="Overview" subtitle="We couldn't load your workspace." />
        <NoCompanyStateCard
          title="Workspace unavailable"
          description={`${companyState.message}${status}. Try again.`}
          canCreateCompany={false}
          onRetryLink={() => void retryLink()}
        />
        <div className="flex justify-end">
          <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  if (companyState.kind === "missing") {
    return (
      <div className="space-y-6">
        <PageHeader title="Overview" subtitle="Your company link looks stale." />
        <NoCompanyStateCard
          title="Company not found"
          description="Your account is linked to a company that no longer exists. Create a new company to continue."
          canCreateCompany={canCreateCompany}
          onRetryLink={() => void retryLink()}
        />
      </div>
    );
  }

  if (!data.company) {
    return (
      <div className="space-y-6">
        <PageHeader title="Overview" subtitle="Set up your company to start using the dashboard." />
        <NoCompanyStateCard
          title={canCreateCompany ? "No company yet" : "Not linked to a company"}
          description={
            canCreateCompany
              ? "Create your company to unlock job cards, inventory, teams, and sites."
              : "This account has a dashboard role but isn't linked to a company. Ask an admin/owner to link you, then retry."
          }
          canCreateCompany={canCreateCompany}
          onRetryLink={() => void retryLink()}
        />
      </div>
    );
  }

  const props = { data, allJobs };

  const tradeDashboard = (() => {
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
  })();

  if (data.company.industry !== undefined && data.company.industry !== "general") {
    return (
      <DensityProvider>
        <div className="space-y-8">
          <AiInsightsCard data={data} />
          {tradeDashboard}
        </div>
      </DensityProvider>
    );
  }

  return <DensityProvider>{tradeDashboard}</DensityProvider>;
}
