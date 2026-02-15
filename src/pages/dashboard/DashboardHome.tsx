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
  DollarSign,
  FileWarning,
  PackageSearch,
  TrendingUp,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isThisMonth(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default function DashboardHome() {
  const { data, loading } = useDashboardData();
  const allowedTradeIds: TradeId[] | null = data.company?.industry && isTradeId(data.company.industry) ? [data.company.industry] : null;
  const { trade } = useTradeFilter(allowedTradeIds);
  const selectors = useDashboardSelectors(data, trade);
  const { lowStock, expiringSoon } = useInventoryAlerts(selectors.inventoryItems);

  const allJobs = selectors.jobCards;
  const jobsToday = allJobs.filter((j) => j.scheduled_at && isToday(j.scheduled_at));
  const activeJobs = allJobs.filter((j) => ["new", "scheduled", "in-progress"].includes(j.status));
  const overdueInvoices = allJobs.filter((j) => j.status === "completed"); // completed but not yet invoiced
  const invoicedThisMonth = allJobs.filter((j) => j.status === "invoiced" && isThisMonth(j.updated_at));

  // Revenue & profit
  const revenueThisMonth = allJobs
    .filter((j) => isThisMonth(j.updated_at))
    .reduce((sum, j) => sum + ((j as any).revenue_cents ?? 0), 0);

  const totalLabourCost = data.technicians.reduce((sum, t) => {
    const techJobs = allJobs.filter((j) => j.technician_id === t.id && isThisMonth(j.updated_at));
    const hours = techJobs.length * 2; // estimate 2 hours per job
    return sum + hours * ((t as any).hourly_cost_cents ?? 0);
  }, 0);

  const profitMargin = revenueThisMonth > 0
    ? Math.round(((revenueThisMonth - totalLabourCost) / revenueThisMonth) * 100)
    : 0;

  // Technician performance
  const techPerformance = data.technicians
    .filter((t) => t.active)
    .map((t) => {
      const techJobs = allJobs.filter((j) => j.technician_id === t.id);
      const completed = techJobs.filter((j) => j.status === "completed" || j.status === "invoiced").length;
      const active = techJobs.filter((j) => j.status === "in-progress").length;
      return { ...t, completed, active, total: techJobs.length };
    })
    .sort((a, b) => b.completed - a.completed);

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

  return (
    <div className="space-y-6">
      <PageHeader title="Owner Dashboard" subtitle={`${data.company.name} — Overview`} />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5" /> Jobs Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobsToday.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5" /> Active Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeJobs.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <FileWarning className="h-3.5 w-3.5" /> Overdue Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overdueInvoices.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Revenue (Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUsdFromCents(revenueThisMonth)}</div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Profit Margin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profitMargin}%</div>
            <Progress value={Math.max(0, profitMargin)} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Technicians
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.technicians.filter((t) => t.active).length}</div>
            <div className="text-xs text-muted-foreground">{data.technicians.length} total</div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Technician Performance */}
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Technician Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {techPerformance.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No active technicians yet.
              </div>
            ) : (
              techPerformance.slice(0, 6).map((tech) => (
                <div key={tech.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{tech.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {tech.active ? (
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                          Active
                        </span>
                      ) : "Inactive"}
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

        {/* Inventory Alerts */}
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
