import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TRADES } from "@/features/company-signup/content/trades";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardSelectors } from "@/features/dashboard/hooks/use-dashboard-selectors";
import { useInventoryAlerts } from "@/features/dashboard/hooks/use-inventory-alerts";
import { useTradeFilter } from "@/features/dashboard/hooks/use-trade-filter";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { AlertTriangle, CalendarClock, PackageSearch } from "lucide-react";

export default function DashboardHome() {
  const { data } = useDashboardData();
  const { trade } = useTradeFilter();
  const selectors = useDashboardSelectors(data, trade);
  const { lowStock, expiringSoon } = useInventoryAlerts(selectors.inventoryItems);

  const openJobs = selectors.jobCards.filter((j) => ["new", "scheduled", "in-progress"].includes(j.status));
  const completedJobs = selectors.jobCards.filter((j) => j.status === "completed" || j.status === "invoiced");

  const tradeLabel =
    trade === "all" ? "All trades" : TRADES.find((t) => t.id === trade)?.name ?? "Trade";

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" subtitle={`Unified dashboard — ${tradeLabel}`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open job cards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{openJobs.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed / invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{completedJobs.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{lowStock.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Perishables expiring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{expiringSoon.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Inventory alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStock.length === 0 && expiringSoon.length === 0 ? (
              <Alert>
                <PackageSearch className="h-4 w-4" />
                <AlertTitle>No alerts</AlertTitle>
                <AlertDescription>Stock levels and perishables look good for the selected trade.</AlertDescription>
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
                        {i.quantityOnHand}/{i.reorderPoint} {i.unit}
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

        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Workspace snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Customers</span>
              <span className="font-medium text-foreground">{data.customers.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Technicians</span>
              <span className="font-medium text-foreground">{data.technicians.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Inventory items</span>
              <span className="font-medium text-foreground">{selectors.inventoryItems.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Trades supported</span>
              <span className="font-medium text-foreground">{TRADES.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

