import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { isTradeId, type TradeId } from "@/features/company-signup/content/trades";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardSelectors } from "@/features/dashboard/hooks/use-dashboard-selectors";
import { useInventoryAlerts } from "@/features/dashboard/hooks/use-inventory-alerts";
import { useTradeFilter } from "@/features/dashboard/hooks/use-trade-filter";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import {
  computeBaseMetrics,
  isToday,
  KpiCard,
  SectionHeader,
} from "@/features/dashboard/components/dashboard-kpi-utils";
import { OpsSnapshot } from "@/features/dashboard/components/overview/ops-snapshot";
import { formatZarFromCents } from "@/lib/money";
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
import { Spinner } from "@/components/ui/spinner";
import NoCompanyStateCard from "@/features/dashboard/components/no-company-state-card";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Button } from "@/components/ui/button";

/* ─── Trade-specific dashboard imports ─── */
import PlumbingDashboard from "@/features/dashboard/components/trade-dashboards/plumbing-dashboard";
import ElectricalDashboard from "@/features/dashboard/components/trade-dashboards/electrical-dashboard";
import MobileMechanicsDashboard from "@/features/dashboard/components/trade-dashboards/mechanics-dashboard";
import RefrigerationDashboard from "@/features/dashboard/components/trade-dashboards/refrigeration-dashboard";
import ApplianceRepairDashboard from "@/features/dashboard/components/trade-dashboards/appliance-dashboard";

/* ─── Fallback generic dashboard ─── */
function GenericDashboard({ data, allJobs }: { data: any; allJobs: any[] }) {
  const base = computeBaseMetrics(allJobs, data.technicians);
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
          <KpiCard icon={FileWarning} label="Unbilled Jobs" value={base.unbilledJobs.length} accent={base.unbilledJobs.length > 0 ? "destructive" : undefined} sub={formatZarFromCents(base.unbilledRevenue) + " at risk"} />
          <KpiCard icon={PackageSearch} label="Low Stock Items" value={lowStock.length} accent={lowStock.length > 0 ? "warning" : undefined} />
          <KpiCard icon={Users} label="Active Techs" value={data.technicians.filter((t: any) => t.active).length} sub={`${data.technicians.length} total`} />
        </div>
      </div>

      {/* SNAPSHOT */}
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

      {/* LOSING MONEY */}
      <div>
        <SectionHeader title="Financial" question="Where am I losing money?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={DollarSign} label="Avg Revenue / Job" value={formatZarFromCents(base.avgRevenuePerJob)} />
          <KpiCard icon={TrendingUp} label="Revenue (Month)" value={formatZarFromCents(base.revenueThisMonth)} />
          <KpiCard icon={Percent} label="Gross Margin" value={`${base.grossMargin}%`} accent={base.grossMargin < 30 ? "destructive" : undefined}>
            <Progress value={Math.max(0, base.grossMargin)} className="mt-2 h-1.5" />
          </KpiCard>
          <KpiCard icon={RefreshCcw} label="Callbacks (30d)" value={base.callbackJobs.length} accent={base.callbackJobs.length > 0 ? "destructive" : undefined} sub="rework erodes profit" />
          <KpiCard icon={FileWarning} label="Unbilled Revenue" value={formatZarFromCents(base.unbilledRevenue)} accent={base.unbilledRevenue > 0 ? "warning" : undefined} />
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
    </div>
  );
}

/* ─── Main export: routes to trade-specific dashboard ─── */
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
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (companyState.kind === "error") {
    const status = companyState.status ? ` (HTTP ${companyState.status})` : "";
    return (
      <div className="space-y-6">
        <PageHeader title="Overview" subtitle="We couldn't load your workspace." />
        <NoCompanyStateCard
          title="Workspace unavailable"
          description={`${companyState.message}${status}. Try again. If this keeps happening, it’s usually a Supabase policy/migration issue rather than your password.`}
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
          description="Your account is linked to a company that no longer exists (or was deleted). Create a new company to continue."
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
              : "This account has a dashboard role but isn’t linked to a company. Ask an admin/owner to link you, then retry."
          }
          canCreateCompany={canCreateCompany}
          onRetryLink={() => void retryLink()}
        />
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
