import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { isTradeId, type TradeId } from "@/features/company-signup/content/trades";
import { useDashboardSelectors } from "@/features/dashboard/hooks/use-dashboard-selectors";
import { useInventoryAlerts } from "@/features/dashboard/hooks/use-inventory-alerts";
import { useTradeFilter } from "@/features/dashboard/hooks/use-trade-filter";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import {
  computeBaseMetrics,
  DensityProvider,
  DensityToggle,
  isToday,
  isLast7Days,
  KpiCardSkeleton,
  useDensity,
} from "@/features/dashboard/components/dashboard-kpi-utils";
import { OpsSnapshot } from "@/features/dashboard/components/overview/ops-snapshot";
import { AiInsightsCard } from "@/features/dashboard/components/overview/ai-insights-card";
import { JobsDonutChart } from "@/features/dashboard/components/overview/jobs-donut-chart";
import { InvoiceOverviewCard } from "@/features/dashboard/components/overview/invoice-overview-card";
import { RecentJobsCard } from "@/features/dashboard/components/overview/recent-jobs-card";
import { OpenTicketsCard } from "@/features/dashboard/components/overview/open-tickets-card";
import { WidgetGrid, type WidgetDefinition } from "@/features/dashboard/components/overview/widget-grid";
import {
  RevenueTrendWidget,
  TechUtilizationWidget,
  SlaComplianceWidget,
  CustomerSatisfactionWidget,
} from "@/features/dashboard/components/overview/extra-widgets";
import { formatZarFromCents } from "@/lib/money";
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  CalendarClock,
  Clock,
  DollarSign,
  FileWarning,
  Flame,
  Heart,
  PackageSearch,
  PieChart,
  Search,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import NoCompanyStateCard from "@/features/dashboard/components/no-company-state-card";
import PageHeader from "@/features/dashboard/components/page-header";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

/* ─── Trade-specific dashboard imports ─── */
import PlumbingDashboard from "@/features/dashboard/components/trade-dashboards/plumbing-dashboard";
import ElectricalDashboard from "@/features/dashboard/components/trade-dashboards/electrical-dashboard";
import MobileMechanicsDashboard from "@/features/dashboard/components/trade-dashboards/mechanics-dashboard";
import RefrigerationDashboard from "@/features/dashboard/components/trade-dashboards/refrigeration-dashboard";
import ApplianceRepairDashboard from "@/features/dashboard/components/trade-dashboards/appliance-dashboard";
import * as React from "react";

/* ─── Dashboard greeting ─── */
function DashboardHeader({ companyName }: { companyName?: string }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          Manage and track your operations
        </p>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1">
          {greeting}{companyName ? `, ${companyName}` : ""}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          {today}
        </div>
        <DensityToggle />
      </div>
    </div>
  );
}

/* ─── Quick stat pill ─── */
function QuickStat({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  href,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "destructive" | "warning" | "success";
  href?: string;
  className?: string;
}) {
  const iconColor =
    accent === "destructive"
      ? "text-destructive bg-destructive/10"
      : accent === "warning"
        ? "text-[hsl(38_92%_50%)] bg-[hsl(38_92%_50%/0.1)]"
        : accent === "success"
          ? "text-[hsl(142_71%_45%)] bg-[hsl(142_71%_45%/0.1)]"
          : "text-primary bg-primary/10";

  const content = (
    <div className={cn(
      "flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-3.5 shadow-sm transition-all",
      href && "hover:shadow-md hover:-translate-y-0.5 cursor-pointer group",
      className,
    )}>
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", iconColor)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
        <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  if (href) return <Link to={href} className="block">{content}</Link>;
  return content;
}

/* ─── Build widget registry ─── */
function useWidgetRegistry(data: any, allJobs: any[], attentionItems: any[]): WidgetDefinition[] {
  return React.useMemo(() => {
    const jobSegments = (() => {
      const statusMap: Record<string, number> = {};
      for (const j of allJobs) {
        statusMap[j.status] = (statusMap[j.status] ?? 0) + 1;
      }
      return [
        { label: "In Progress", count: statusMap["in-progress"] ?? 0, color: "hsl(var(--chart-1))" },
        { label: "Completed", count: (statusMap["completed"] ?? 0) + (statusMap["invoiced"] ?? 0), color: "hsl(var(--chart-3))" },
        { label: "Scheduled", count: statusMap["scheduled"] ?? 0, color: "hsl(var(--chart-4))" },
        { label: "New", count: statusMap["new"] ?? 0, color: "hsl(var(--chart-2))" },
      ].filter((s) => s.count > 0);
    })();

    const base = computeBaseMetrics(allJobs, data.technicians);

    return [
      {
        id: "jobs-donut",
        label: "Jobs Overview",
        icon: PieChart,
        description: "Donut chart showing job status distribution",
        defaultSize: "sm",
        render: () => (
          <Card className="shadow-sm border-border/40 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
                <span>Jobs Overview</span>
                <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <Link to="/dashboard/jobs"><TrendingUp className="h-3.5 w-3.5" /></Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <JobsDonutChart segments={jobSegments} />
            </CardContent>
          </Card>
        ),
      },
      {
        id: "invoice-overview",
        label: "Invoice Overview",
        icon: DollarSign,
        description: "Breakdown of invoice statuses and amounts",
        defaultSize: "sm",
        render: () => <InvoiceOverviewCard invoices={data.invoices ?? []} />,
      },
      {
        id: "attention",
        label: "Attention Needed",
        icon: AlertTriangle,
        description: "Items requiring immediate action",
        defaultSize: "sm",
        render: () => <OpenTicketsCard items={attentionItems} />,
      },
      {
        id: "recent-jobs",
        label: "Recent Activity",
        icon: Briefcase,
        description: "Latest job updates and status changes",
        defaultSize: "sm",
        render: () => <RecentJobsCard jobs={allJobs} technicians={data.technicians} />,
      },
      {
        id: "ai-insights",
        label: "AI Insights",
        icon: Sparkles,
        description: "AI-powered business insights and recommendations",
        defaultSize: "sm",
        render: () => <AiInsightsCard data={data} />,
      },
      {
        id: "financial-summary",
        label: "Financial Summary",
        icon: BarChart3,
        description: "Key financial metrics and margins",
        defaultSize: "sm",
        render: () => (
          <Card className="shadow-sm border-border/40 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Financial Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Avg Revenue / Job</span>
                <span className="text-sm font-semibold">{formatZarFromCents(base.avgRevenuePerJob)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Gross Margin</span>
                <span className={cn("text-sm font-semibold", base.grossMargin < 30 ? "text-destructive" : "text-foreground")}>
                  {base.grossMargin}%
                </span>
              </div>
              <Progress value={Math.max(0, base.grossMargin)} className="h-1.5" />
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Unbilled Revenue</span>
                <span className="text-sm font-semibold text-destructive">{formatZarFromCents(base.unbilledRevenue)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Callbacks (30d)</span>
                <Badge variant={base.callbackJobs.length > 0 ? "destructive" : "secondary"}>
                  {base.callbackJobs.length}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ),
      },
      {
        id: "revenue-trend",
        label: "Revenue Trend",
        icon: TrendingUp,
        description: "Weekly revenue trend with sparkline",
        defaultSize: "sm",
        render: () => <RevenueTrendWidget jobs={allJobs} />,
      },
      {
        id: "tech-utilization",
        label: "Technician Utilization",
        icon: Users,
        description: "Jobs per technician this month",
        defaultSize: "sm",
        render: () => <TechUtilizationWidget jobs={allJobs} technicians={data.technicians} />,
      },
      {
        id: "sla-compliance",
        label: "SLA Compliance",
        icon: Clock,
        description: "Response time compliance rates",
        defaultSize: "sm",
        render: () => <SlaComplianceWidget jobs={allJobs} />,
      },
      {
        id: "customer-satisfaction",
        label: "Customer Satisfaction",
        icon: Heart,
        description: "Satisfaction score based on callbacks",
        defaultSize: "sm",
        render: () => <CustomerSatisfactionWidget jobs={allJobs} />,
      },
    ];
  }, [data, allJobs, attentionItems]);
}

const DEFAULT_WIDGET_LAYOUT = [
  "jobs-donut",
  "invoice-overview",
  "attention",
  "recent-jobs",
  "ai-insights",
  "financial-summary",
];

/* ─── Fallback generic dashboard ─── */
function GenericDashboard({ data, allJobs }: { data: any; allJobs: any[] }) {
  const base = computeBaseMetrics(allJobs, data.technicians);
  const { lowStock, expiringSoon } = useInventoryAlerts(data.inventoryItems);
  const { density } = useDensity();

  const jobsToday = allJobs.filter((j) => j.scheduled_at && isToday(j.scheduled_at));
  const emergencyToday = jobsToday.filter((j) => j.priority === "urgent" || j.priority === "emergency");
  const activeTechs = data.technicians.filter((t: any) => t.active).length;

  // Build attention items
  const attentionItems = React.useMemo(() => {
    const items: any[] = [];
    if (emergencyToday.length > 0) {
      items.push({
        id: "emergency",
        name: `${emergencyToday.length} Emergency job${emergencyToday.length > 1 ? "s" : ""} today`,
        message: "Urgent jobs requiring immediate dispatch",
        severity: "critical",
        href: "/dashboard/jobs",
      });
    }
    if (base.unbilledJobs.length > 0) {
      items.push({
        id: "unbilled",
        name: `${base.unbilledJobs.length} Unbilled job${base.unbilledJobs.length > 1 ? "s" : ""}`,
        message: `${formatZarFromCents(base.unbilledRevenue)} revenue at risk`,
        severity: "warning",
        href: "/dashboard/invoices",
      });
    }
    if (lowStock.length > 0) {
      items.push({
        id: "lowstock",
        name: `${lowStock.length} item${lowStock.length > 1 ? "s" : ""} below reorder`,
        message: "Stock running low — reorder to avoid delays",
        severity: "warning",
        href: "/dashboard/inventory",
      });
    }
    if (base.callbackJobs.length > 0) {
      items.push({
        id: "callbacks",
        name: `${base.callbackJobs.length} callback${base.callbackJobs.length > 1 ? "s" : ""} (30d)`,
        message: "Rework erodes profit — review quality",
        severity: "critical",
        href: "/dashboard/jobs",
      });
    }
    if (expiringSoon.length > 0) {
      items.push({
        id: "expiring",
        name: `${expiringSoon.length} item${expiringSoon.length > 1 ? "s" : ""} expiring soon`,
        message: "Perishable stock nearing expiry",
        severity: "warning",
        href: "/dashboard/inventory",
      });
    }
    return items;
  }, [emergencyToday, base, lowStock, expiringSoon]);

  const widgetRegistry = useWidgetRegistry(data, allJobs, attentionItems);

  return (
    <div className="space-y-6">
      <DashboardHeader companyName={data.company?.name} />

      {/* Quick stats row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <QuickStat
          icon={Flame}
          label="Emergency"
          value={emergencyToday.length}
          accent={emergencyToday.length > 0 ? "destructive" : undefined}
          href="/dashboard/jobs"
        />
        <QuickStat
          icon={Briefcase}
          label="Jobs Today"
          value={jobsToday.length}
          href="/dashboard/jobs"
        />
        <QuickStat
          icon={DollarSign}
          label="Revenue (Month)"
          value={formatZarFromCents(base.revenueThisMonth)}
          accent="success"
          href="/dashboard/invoices"
        />
        <QuickStat
          icon={Users}
          label="Active Techs"
          value={activeTechs}
          sub={`${data.technicians.length} total`}
          href="/dashboard/technicians"
        />
        <QuickStat
          icon={Clock}
          label="Avg Response"
          value={`${base.avgResponseHrs}h`}
          sub="created → scheduled"
          className="hidden xl:flex"
        />
      </div>

      {/* Draggable widget grid */}
      <WidgetGrid
        registry={widgetRegistry}
        defaultLayout={DEFAULT_WIDGET_LAYOUT}
        widgetProps={{ data, allJobs }}
      />

      {/* Full-width operations section */}
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
    </div>
  );
}

/* ─── Loading skeleton ─── */
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-40 rounded bg-muted animate-pulse" />
        <div className="h-7 w-56 rounded-lg bg-muted animate-pulse" />
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/40 bg-card p-3.5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
              <div className="space-y-1.5 flex-1">
                <div className="h-2.5 w-12 rounded bg-muted animate-pulse" />
                <div className="h-5 w-16 rounded bg-muted animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/40 bg-card p-6 shadow-sm h-64 animate-pulse" />
        ))}
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
        <div className="space-y-6">
          <AiInsightsCard data={data} />
          {tradeDashboard}
        </div>
      </DensityProvider>
    );
  }

  return <DensityProvider>{tradeDashboard}</DensityProvider>;
}
