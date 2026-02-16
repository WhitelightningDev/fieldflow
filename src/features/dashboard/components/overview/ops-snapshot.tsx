import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SectionHeader, isThisMonth, isToday } from "@/features/dashboard/components/dashboard-kpi-utils";
import { useInventoryAlerts } from "@/features/dashboard/hooks/use-inventory-alerts";
import type { Tables } from "@/integrations/supabase/types";
import { formatZarFromCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { MapPin, PackageSearch, Users } from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";

type InventoryItem = Tables<"inventory_items">;
type Technician = Tables<"technicians">;
type JobCard = Tables<"job_cards">;
type Site = Tables<"sites">;

export function OpsSnapshot({
  inventoryItems,
  technicians,
  jobs,
  sites,
  title = "Overview",
}: {
  inventoryItems: InventoryItem[];
  technicians: Technician[];
  jobs: JobCard[];
  sites: Site[];
  title?: string;
}) {
  return (
    <div>
      <SectionHeader title={title} question="What needs attention right now?" />
      <div className="grid gap-4 lg:grid-cols-2">
        <LowStockOverviewCard items={inventoryItems} />
        <TechnicianStatusOverviewCard technicians={technicians} jobs={jobs} sites={sites} />
      </div>
    </div>
  );
}

function LowStockOverviewCard({ items }: { items: InventoryItem[] }) {
  const { lowStock, expiringSoon } = useInventoryAlerts(items);
  const top = React.useMemo(() => {
    const scored = [...lowStock].sort((a, b) => {
      const aPct = a.reorder_point > 0 ? a.quantity_on_hand / a.reorder_point : 0;
      const bPct = b.reorder_point > 0 ? b.quantity_on_hand / b.reorder_point : 0;
      return aPct - bPct;
    });
    return scored.slice(0, 6);
  }, [lowStock]);

  return (
    <Card className="bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <PackageSearch className="h-4 w-4" />
            Low Stock
          </span>
          <div className="flex items-center gap-2">
            {expiringSoon.length > 0 ? (
              <Badge variant="secondary">{expiringSoon.length} expiring</Badge>
            ) : null}
            <Badge className={lowStock.length > 0 ? "bg-amber-600 hover:bg-amber-600" : undefined}>
              {lowStock.length} below reorder
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {top.length === 0 ? (
          <div className="text-sm text-muted-foreground">No low-stock items right now.</div>
        ) : (
          <div className="space-y-2">
            {top.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{i.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {i.trade_id ? <span className="capitalize">{i.trade_id}</span> : "General"} · Unit: {i.unit}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold">
                    {i.quantity_on_hand}/{i.reorder_point}
                  </div>
                  <div className="text-[10px] text-muted-foreground">on hand / reorder</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-end">
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/inventory">Open inventory</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type TechStatus = "available" | "on-job" | "inactive";

function TechnicianStatusOverviewCard({
  technicians,
  jobs,
  sites,
}: {
  technicians: Technician[];
  jobs: JobCard[];
  sites: Site[];
}) {
  const siteById = React.useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  const rows = React.useMemo(() => {
    return technicians
      .map((t) => {
        const techJobs = jobs.filter((j) => j.technician_id === t.id);
        const inProgress = techJobs.find((j) => j.status === "in-progress") ?? null;
        const nextToday =
          techJobs.find((j) => j.scheduled_at && isToday(j.scheduled_at) && j.status === "scheduled") ?? null;
        const current = inProgress ?? nextToday;

        const status: TechStatus = !t.active ? "inactive" : current ? "on-job" : "available";

        const monthJobs = techJobs.filter((j) => j.updated_at && isThisMonth(j.updated_at));
        const monthRevenue = monthJobs.reduce((sum, j) => sum + (j.revenue_cents ?? 0), 0);
        const completed = monthJobs.filter((j) => j.status === "completed" || j.status === "invoiced").length;
        const returns = monthJobs.filter((j) =>
          String(j.notes ?? "").toLowerCase().match(/callback|return|rework/),
        ).length;
        const fixRate = completed > 0 ? Math.round(((completed - returns) / completed) * 100) : 0;

        const todayOpen = techJobs.filter(
          (j) => j.scheduled_at && isToday(j.scheduled_at) && !["completed", "invoiced", "cancelled"].includes(j.status),
        ).length;

        const siteName =
          current?.site_id && siteById.get(current.site_id)?.name ? siteById.get(current.site_id)!.name : null;
        const where = current
          ? siteName
            ? `On site: ${siteName}`
            : current.title
              ? `On job: ${current.title}`
              : "On job"
          : t.active
            ? "Ready to dispatch"
            : "Inactive";

        return {
          id: t.id,
          name: t.name,
          status,
          where,
          todayOpen,
          fixRate,
          monthRevenue,
        };
      })
      .sort((a, b) => {
        const order: Record<TechStatus, number> = { "on-job": 0, available: 1, inactive: 2 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return b.monthRevenue - a.monthRevenue;
      });
  }, [jobs, siteById, technicians]);

  const summary = React.useMemo(() => {
    const onJob = rows.filter((r) => r.status === "on-job").length;
    const available = rows.filter((r) => r.status === "available").length;
    const inactive = rows.filter((r) => r.status === "inactive").length;
    return { onJob, available, inactive };
  }, [rows]);

  return (
    <Card className="bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4" />
            Technician Status
          </span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <StatusDot status="available" /> {summary.available}
            </span>
            <span className="inline-flex items-center gap-1">
              <StatusDot status="on-job" /> {summary.onJob}
            </span>
            <span className="inline-flex items-center gap-1">
              <StatusDot status="inactive" /> {summary.inactive}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No technicians yet.</div>
        ) : (
          <div className="space-y-3">
            {rows.slice(0, 8).map((r, idx) => (
              <div key={r.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusDot status={r.status} />
                      <div className="text-sm font-medium truncate">{r.name}</div>
                      <Badge variant="secondary" className="hidden sm:inline-flex">
                        {r.status === "on-job" ? "On job" : r.status === "available" ? "Available" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="truncate">{r.where}</span>
                      <span className="hidden sm:inline">·</span>
                      <span className="hidden sm:inline">{r.todayOpen} jobs today</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold">{formatZarFromCents(r.monthRevenue)}</div>
                    <div className={cn("text-[10px]", r.fixRate < 80 ? "text-destructive" : "text-muted-foreground")}>
                      {r.fixRate}% fix rate (month)
                    </div>
                  </div>
                </div>
                {idx < rows.slice(0, 8).length - 1 ? <Separator className="mt-3" /> : null}
              </div>
            ))}
          </div>
        )}

        <div className="text-[11px] text-muted-foreground">
          Tip: “Where” is based on the technician’s assigned job + site. Live GPS tracking can be added when techs use the
          mobile dispatch view.
        </div>
      </CardContent>
    </Card>
  );
}

function StatusDot({ status }: { status: TechStatus }) {
  const cls =
    status === "available"
      ? "bg-emerald-500"
      : status === "on-job"
        ? "bg-sky-500 animate-pulse"
        : "bg-rose-500";
  return <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", cls)} aria-hidden="true" />;
}
