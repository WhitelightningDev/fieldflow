import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isTradeId, type TradeId, TRADES } from "@/features/company-signup/content/trades";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardSelectors } from "@/features/dashboard/hooks/use-dashboard-selectors";
import { useInventoryAlerts } from "@/features/dashboard/hooks/use-inventory-alerts";
import { useTradeFilter } from "@/features/dashboard/hooks/use-trade-filter";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { formatUsdFromCents } from "@/lib/money";
import {
  AlertTriangle,
  Briefcase,
  CalendarClock,
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
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isLast24h(dateStr: string) {
  return Date.now() - new Date(dateStr).getTime() < 86_400_000;
}

function isThisMonth(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isLast30Days(dateStr: string) {
  return Date.now() - new Date(dateStr).getTime() < 30 * 86_400_000;
}

/* ─── Plumbing Owner Dashboard ─── */
function PlumbingDashboard({
  data,
  allJobs,
}: {
  data: ReturnType<typeof useDashboardData>["data"];
  allJobs: any[];
}) {
  const jobsToday = allJobs.filter((j) => j.scheduled_at && isToday(j.scheduled_at));
  const emergencyToday = jobsToday.filter((j) => j.priority === "urgent" || j.priority === "emergency");
  const leakCallouts24h = allJobs.filter(
    (j) => j.created_at && isLast24h(j.created_at) && (j.title?.toLowerCase().includes("leak") || j.description?.toLowerCase().includes("leak")),
  );
  const awaitingParts = allJobs.filter((j) => j.status === "new" || (j.notes?.toLowerCase().includes("awaiting parts")));
  const completedJobs = allJobs.filter((j) => j.status === "completed" || j.status === "invoiced");
  const callbackJobs = allJobs.filter(
    (j) =>
      isLast30Days(j.created_at) &&
      (j.notes?.toLowerCase().includes("callback") || j.notes?.toLowerCase().includes("rework") || j.notes?.toLowerCase().includes("return")),
  );

  // Financial
  const monthJobs = allJobs.filter((j) => isThisMonth(j.updated_at));
  const revenueThisMonth = monthJobs.reduce((s, j) => s + (j.revenue_cents ?? 0), 0);
  const completedMonthJobs = monthJobs.filter((j) => j.status === "invoiced" || j.status === "completed");
  const avgRevenuePerJob = completedMonthJobs.length > 0 ? Math.round(revenueThisMonth / completedMonthJobs.length) : 0;
  const waterHeaterJobs = monthJobs.filter(
    (j) => j.title?.toLowerCase().includes("water heater") || j.title?.toLowerCase().includes("geyser"),
  );
  const afterHoursJobs = monthJobs.filter((j) => {
    if (!j.scheduled_at) return false;
    const h = new Date(j.scheduled_at).getHours();
    return h < 7 || h >= 18;
  });
  const afterHoursRevenue = afterHoursJobs.reduce((s, j) => s + (j.revenue_cents ?? 0), 0);

  const totalLabourCost = data.technicians.reduce((sum, t) => {
    const techJobs = monthJobs.filter((j) => j.technician_id === t.id);
    const hours = techJobs.length * 2;
    return sum + hours * (t.hourly_cost_cents ?? 0);
  }, 0);
  const grossMargin = revenueThisMonth > 0 ? Math.round(((revenueThisMonth - totalLabourCost) / revenueThisMonth) * 100) : 0;

  // Technician metrics
  const techMetrics = data.technicians
    .filter((t) => t.active)
    .map((t) => {
      const techJobs = allJobs.filter((j) => j.technician_id === t.id);
      const completed = techJobs.filter((j) => j.status === "completed" || j.status === "invoiced").length;
      const returnVisits = techJobs.filter(
        (j) => j.notes?.toLowerCase().includes("callback") || j.notes?.toLowerCase().includes("return"),
      ).length;
      const firstTimeFix = completed > 0 ? Math.round(((completed - returnVisits) / completed) * 100) : 0;
      const revenue = techJobs.reduce((s, j) => s + (j.revenue_cents ?? 0), 0);
      return { ...t, completed, returnVisits, firstTimeFix, revenue, total: techJobs.length };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // Response time (estimate from scheduled_at - created_at)
  const responseTimes = allJobs
    .filter((j) => j.scheduled_at && j.created_at)
    .map((j) => (new Date(j.scheduled_at).getTime() - new Date(j.created_at).getTime()) / 3_600_000);
  const avgResponseTime = responseTimes.length > 0 ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1) : "—";

  return (
    <div className="space-y-6">
      <PageHeader title="Plumbing Dashboard" subtitle={`${data.company?.name} — Owner Overview`} />

      {/* ─── OPERATIONAL ─── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Operational</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={Flame} label="Emergency Jobs Today" value={emergencyToday.length} accent={emergencyToday.length > 0 ? "destructive" : undefined} />
          <KpiCard icon={Droplets} label="Leak Callouts (24h)" value={leakCallouts24h.length} />
          <KpiCard icon={Clock} label="Avg Response Time" value={`${avgResponseTime}h`} />
          <KpiCard icon={PackageSearch} label="Awaiting Parts" value={awaitingParts.length} />
          <KpiCard icon={RefreshCcw} label="Callbacks (30d)" value={callbackJobs.length} accent={callbackJobs.length > 0 ? "destructive" : undefined} />
        </div>
      </div>

      {/* ─── FINANCIAL ─── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Financial</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={DollarSign} label="Avg Revenue / Job" value={formatUsdFromCents(avgRevenuePerJob)} />
          <KpiCard icon={Wrench} label="Water Heater Installs" value={waterHeaterJobs.length} sub="this month" />
          <KpiCard icon={TrendingUp} label="Revenue (Month)" value={formatUsdFromCents(revenueThisMonth)} />
          <KpiCard icon={Percent} label="Gross Margin" value={`${grossMargin}%`}>
            <Progress value={Math.max(0, grossMargin)} className="mt-2 h-1.5" />
          </KpiCard>
          <KpiCard icon={PhoneCall} label="After-Hours Revenue" value={formatUsdFromCents(afterHoursRevenue)} />
        </div>
      </div>

      {/* ─── RISK / COMPLIANCE ─── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Risk / Compliance</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Gas Compliance Certs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">—</div>
              <p className="text-xs text-muted-foreground mt-1">Track via Service Calls</p>
            </CardContent>
          </Card>
          <Card className="bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" /> Pressure Tests Done
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">—</div>
              <p className="text-xs text-muted-foreground mt-1">Track via Service Calls</p>
            </CardContent>
          </Card>
          <Card className="bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <FileWarning className="h-3.5 w-3.5" /> Insurance Docs Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">Review</div>
              <p className="text-xs text-muted-foreground mt-1">Ensure docs are up to date</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── TECHNICIAN METRICS ─── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Technician Metrics</h2>
        {callbackJobs.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Rework Alert</AlertTitle>
            <AlertDescription>
              {callbackJobs.length} callback/rework job{callbackJobs.length > 1 ? "s" : ""} in the last 30 days. Callbacks and rework erode profit margins — investigate root causes.
            </AlertDescription>
          </Alert>
        )}
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardContent className="pt-6 space-y-4">
            {techMetrics.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">No active plumbers yet.</div>
            ) : (
              techMetrics.map((tech) => (
                <div key={tech.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{tech.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {tech.completed} completed · {tech.returnVisits} return visits
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm shrink-0">
                      <div className="text-center">
                        <div className="font-bold">{tech.firstTimeFix}%</div>
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
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─── Generic KPI Card ─── */
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  children,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "destructive";
  children?: React.ReactNode;
}) {
  return (
    <Card className="bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" /> {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${accent === "destructive" ? "text-destructive" : ""}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        {children}
      </CardContent>
    </Card>
  );
}

/* ─── Generic Owner Dashboard (non-plumbing) ─── */
function GenericDashboard({
  data,
  allJobs,
}: {
  data: ReturnType<typeof useDashboardData>["data"];
  allJobs: any[];
}) {
  const jobsToday = allJobs.filter((j) => j.scheduled_at && isToday(j.scheduled_at));
  const activeJobs = allJobs.filter((j) => ["new", "scheduled", "in-progress"].includes(j.status));
  const overdueInvoices = allJobs.filter((j) => j.status === "completed");
  const invoicedThisMonth = allJobs.filter((j) => j.status === "invoiced" && isThisMonth(j.updated_at));

  const revenueThisMonth = allJobs
    .filter((j) => isThisMonth(j.updated_at))
    .reduce((sum, j) => sum + (j.revenue_cents ?? 0), 0);

  const totalLabourCost = data.technicians.reduce((sum, t) => {
    const techJobs = allJobs.filter((j) => j.technician_id === t.id && isThisMonth(j.updated_at));
    const hours = techJobs.length * 2;
    return sum + hours * (t.hourly_cost_cents ?? 0);
  }, 0);

  const profitMargin = revenueThisMonth > 0
    ? Math.round(((revenueThisMonth - totalLabourCost) / revenueThisMonth) * 100)
    : 0;

  const techPerformance = data.technicians
    .filter((t) => t.active)
    .map((t) => {
      const techJobs = allJobs.filter((j) => j.technician_id === t.id);
      const completed = techJobs.filter((j) => j.status === "completed" || j.status === "invoiced").length;
      const active = techJobs.filter((j) => j.status === "in-progress").length;
      return { ...t, completed, active, total: techJobs.length };
    })
    .sort((a, b) => b.completed - a.completed);

  const { lowStock, expiringSoon } = useInventoryAlerts(
    data.inventoryItems,
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Owner Dashboard" subtitle={`${data.company?.name} — Overview`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard icon={Briefcase} label="Jobs Today" value={jobsToday.length} />
        <KpiCard icon={Briefcase} label="Active Jobs" value={activeJobs.length} />
        <KpiCard icon={FileWarning} label="Overdue Invoices" value={overdueInvoices.length} accent={overdueInvoices.length > 0 ? "destructive" : undefined} />
        <KpiCard icon={DollarSign} label="Revenue (Month)" value={formatUsdFromCents(revenueThisMonth)} />
        <KpiCard icon={TrendingUp} label="Profit Margin" value={`${profitMargin}%`}>
          <Progress value={Math.max(0, profitMargin)} className="mt-2 h-1.5" />
        </KpiCard>
        <KpiCard icon={Users} label="Technicians" value={data.technicians.filter((t) => t.active).length} sub={`${data.technicians.length} total`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Technician Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {techPerformance.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">No active technicians yet.</div>
            ) : (
              techPerformance.slice(0, 6).map((tech) => (
                <div key={tech.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{tech.name}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                        Active
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm shrink-0">
                    <div className="text-center">
                      <div className="font-bold">{tech.completed}</div>
                      <div className="text-[10px] text-muted-foreground">Done</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold">{tech.active}</div>
                      <div className="text-[10px] text-muted-foreground">Active</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold">{tech.total}</div>
                      <div className="text-[10px] text-muted-foreground">Total</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Inventory Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStock.length === 0 && expiringSoon.length === 0 ? (
              <Alert>
                <PackageSearch className="h-4 w-4" />
                <AlertTitle>No alerts</AlertTitle>
                <AlertDescription>Stock levels and perishables look good.</AlertDescription>
              </Alert>
            ) : null}

            {lowStock.length > 0 ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Low stock</AlertTitle>
                <AlertDescription>
                  {lowStock.slice(0, 4).map((i) => (
                    <div key={i.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{i.name}</span>
                      <Badge variant="outline">
                        {i.quantity_on_hand}/{i.reorder_point} {i.unit}
                      </Badge>
                    </div>
                  ))}
                  {lowStock.length > 4 ? <div className="text-xs mt-2 opacity-80">+{lowStock.length - 4} more</div> : null}
                </AlertDescription>
              </Alert>
            ) : null}

            {expiringSoon.length > 0 ? (
              <Alert>
                <CalendarClock className="h-4 w-4" />
                <AlertTitle>Expiring soon</AlertTitle>
                <AlertDescription>
                  {expiringSoon.slice(0, 4).map((i) => (
                    <div key={i.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{i.name}</span>
                      <Badge variant="secondary">Perishable</Badge>
                    </div>
                  ))}
                  {expiringSoon.length > 4 ? <div className="text-xs mt-2 opacity-80">+{expiringSoon.length - 4} more</div> : null}
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─── Main export ─── */
export default function DashboardHome() {
  const { data, loading } = useDashboardData();
  const allowedTradeIds: TradeId[] | null = data.company?.industry && isTradeId(data.company.industry) ? [data.company.industry] : null;
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

  if (data.company.industry === "plumbing") {
    return <PlumbingDashboard data={data} allJobs={allJobs} />;
  }

  return <GenericDashboard data={data} allJobs={allJobs} />;
}
