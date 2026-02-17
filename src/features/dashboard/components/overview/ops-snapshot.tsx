import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionHeader, isThisMonth, isToday } from "@/features/dashboard/components/dashboard-kpi-utils";
import JobStatusBadge from "@/features/dashboard/components/job-status-badge";
import { computeJobProfitability } from "@/features/dashboard/lib/profitability";
import { useInventoryAlerts } from "@/features/dashboard/hooks/use-inventory-alerts";
import type { Tables } from "@/integrations/supabase/types";
import { distanceMeters, formatDistance, getLatLngFromAny, isArrived } from "@/lib/geo";
import { formatZarFromCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ArrowUpRight, CalendarDays, MapPin, PackageSearch, TrendingUp, Users } from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

type InventoryItem = Tables<"inventory_items">;
type Technician = Tables<"technicians">;
type JobCard = Tables<"job_cards">;
type Site = Tables<"sites">;
type TechnicianLocation = Tables<"technician_locations">;
type JobTimeEntry = Tables<"job_time_entries">;
type SiteMaterialUsage = Tables<"site_material_usage"> & { quantity_wasted?: number | null };

export function OpsSnapshot({
  inventoryItems,
  technicians,
  jobs,
  sites,
  technicianLocations,
  jobTimeEntries,
  siteMaterialUsage,
  title = "Overview",
}: {
  inventoryItems: InventoryItem[];
  technicians: Technician[];
  jobs: JobCard[];
  sites: Site[];
  technicianLocations: TechnicianLocation[];
  jobTimeEntries: JobTimeEntry[];
  siteMaterialUsage: SiteMaterialUsage[];
  title?: string;
}) {
  return (
    <div>
      <SectionHeader title={title} question="What needs attention right now?" />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          <DispatchBoardCard jobs={jobs} sites={sites} technicians={technicians} />
          <FinancialTrendsCard
            jobs={jobs}
            technicians={technicians}
            inventoryItems={inventoryItems}
            jobTimeEntries={jobTimeEntries}
            siteMaterialUsage={siteMaterialUsage}
          />
        </div>
        <div className="lg:col-span-5 space-y-4">
          <TechnicianStatusOverviewCard technicians={technicians} jobs={jobs} sites={sites} />
          <TechnicianLiveLocationsOverviewCard technicians={technicians} technicianLocations={technicianLocations} jobs={jobs} sites={sites} />
          <LowStockOverviewCard items={inventoryItems} />
        </div>
      </div>
    </div>
  );
}

function LowStockOverviewCard({ items }: { items: InventoryItem[] }) {
  const { lowStock, expiringSoon } = useInventoryAlerts(items);
  const inventoryValueCents = React.useMemo(() => {
    let total = 0;
    for (const i of items) {
      const unitCost = (i as any)?.unit_cost_cents;
      if (typeof unitCost !== "number" || !Number.isFinite(unitCost)) continue;
      const qty = (i as any)?.quantity_on_hand;
      if (typeof qty !== "number" || !Number.isFinite(qty)) continue;
      total += Math.max(0, qty) * unitCost;
    }
    return total;
  }, [items]);
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
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{items.length} items tracked</span>
          <span className="font-medium text-foreground">{formatZarFromCents(inventoryValueCents)} est. value</span>
        </div>
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

function DispatchBoardCard({
  jobs,
  sites,
  technicians,
}: {
  jobs: JobCard[];
  sites: Site[];
  technicians: Technician[];
}) {
  const techById = React.useMemo(() => new Map(technicians.map((t) => [t.id, t])), [technicians]);
  const siteById = React.useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  const todayStart = React.useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const tomorrowStart = React.useMemo(() => {
    const d = new Date(todayStart);
    d.setDate(d.getDate() + 1);
    return d;
  }, [todayStart]);
  const in7Days = React.useMemo(() => {
    const d = new Date(todayStart);
    d.setDate(d.getDate() + 7);
    return d;
  }, [todayStart]);

  const getScheduledAt = (j: JobCard) => {
    const s = (j as any).scheduled_at as string | null | undefined;
    return s ? new Date(s) : null;
  };

  const inProgress = React.useMemo(() => {
    return jobs
      .filter((j) => j.status === "in-progress")
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [jobs]);

  const today = React.useMemo(() => {
    return jobs
      .filter((j) => {
        if (j.status === "in-progress") return true;
        const at = getScheduledAt(j);
        if (!at) return false;
        return at >= todayStart && at < tomorrowStart;
      })
      .sort((a, b) => {
        const aAt = getScheduledAt(a)?.getTime() ?? Infinity;
        const bAt = getScheduledAt(b)?.getTime() ?? Infinity;
        return aAt - bAt;
      });
  }, [jobs, todayStart, tomorrowStart]);

  const upcoming = React.useMemo(() => {
    return jobs
      .filter((j) => {
        if (j.status !== "scheduled") return false;
        const at = getScheduledAt(j);
        if (!at) return false;
        return at >= tomorrowStart && at < in7Days;
      })
      .sort((a, b) => (getScheduledAt(a)?.getTime() ?? Infinity) - (getScheduledAt(b)?.getTime() ?? Infinity));
  }, [jobs, in7Days, tomorrowStart]);

  const unassigned = React.useMemo(() => {
    return jobs
      .filter((j) => (j.status === "new" || j.status === "scheduled") && !j.technician_id)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [jobs]);

  const renderRows = (rows: JobCard[]) => {
    if (rows.length === 0) {
      return (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Nothing to show.
        </div>
      );
    }

    return (
      <div className="rounded-lg border bg-background/40 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Date</TableHead>
              <TableHead className="w-[140px]">Technician</TableHead>
              <TableHead className="w-[220px]">Site</TableHead>
              <TableHead>Job</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 12).map((j) => {
              const site = j.site_id ? siteById.get(j.site_id) : null;
              const tech = j.technician_id ? techById.get(j.technician_id) : null;
              const at = getScheduledAt(j);
              const address = (site as any)?.address ?? (j as any)?.site_location ?? null;
              return (
                <TableRow key={j.id} className="align-top">
                  <TableCell className="text-xs text-muted-foreground">
                    {at ? (
                      <div className="space-y-0.5">
                        <div className="font-medium text-foreground">{format(at, "EEE, MMM d")}</div>
                        <div>{format(at, "p")}</div>
                      </div>
                    ) : (
                      <span>—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="font-medium">{tech?.name ?? "Unassigned"}</div>
                    {tech?.phone ? <div className="text-xs text-muted-foreground">{tech.phone}</div> : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="font-medium truncate">{site?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 min-w-0">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{address ?? "No address"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[340px]">
                    <div className="font-medium">{j.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{j.description ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <JobStatusBadge status={j.status} />
                      {(j as any).priority ? (
                        <Badge variant="secondary" className="capitalize">{String((j as any).priority)}</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Card className="bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Dispatch Board
          </span>
          <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
            <Link to="/dashboard/jobs">
              Open jobs <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs defaultValue="today" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="today">Today <span className="ml-2 text-muted-foreground">({today.length})</span></TabsTrigger>
            <TabsTrigger value="upcoming">Next 7 days <span className="ml-2 text-muted-foreground">({upcoming.length})</span></TabsTrigger>
            <TabsTrigger value="progress">In progress <span className="ml-2 text-muted-foreground">({inProgress.length})</span></TabsTrigger>
            <TabsTrigger value="unassigned">Unassigned <span className="ml-2 text-muted-foreground">({unassigned.length})</span></TabsTrigger>
          </TabsList>
          <TabsContent value="today" className="mt-3">{renderRows(today)}</TabsContent>
          <TabsContent value="upcoming" className="mt-3">{renderRows(upcoming)}</TabsContent>
          <TabsContent value="progress" className="mt-3">{renderRows(inProgress)}</TabsContent>
          <TabsContent value="unassigned" className="mt-3">{renderRows(unassigned)}</TabsContent>
        </Tabs>

        <div className="text-[11px] text-muted-foreground">
          Tip: Keep site GPS coordinates updated to improve routing and ETA decisions.
        </div>
      </CardContent>
    </Card>
  );
}

function TechnicianLiveLocationsOverviewCard({
  technicians,
  technicianLocations,
  jobs,
  sites,
}: {
  technicians: Technician[];
  technicianLocations: TechnicianLocation[];
  jobs: JobCard[];
  sites: Site[];
}) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const siteById = React.useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  const locationsByTechId = React.useMemo(() => {
    const m = new Map<string, TechnicianLocation>();
    for (const loc of technicianLocations ?? []) {
      const tid = (loc as any)?.technician_id as string | undefined;
      if (!tid) continue;
      m.set(tid, loc);
    }
    return m;
  }, [technicianLocations]);

  const rows = React.useMemo(() => {
    return technicians.map((t) => {
      const loc = locationsByTechId.get(t.id) ?? null;
      const last = (loc?.updated_at ?? (loc as any)?.recorded_at) as string | null | undefined;
      const lastMs = last ? new Date(last).getTime() : null;
      const isLive = lastMs != null && now - lastMs < 2 * 60 * 1000;

       const locJobId = (loc as any)?.job_card_id as string | null | undefined;
       const locJob = locJobId ? (jobs as any[]).find((j) => j.id === locJobId) ?? null : null;
       const techJobs = jobs.filter((j: any) => j.technician_id === t.id);
       const inProgress = techJobs.find((j: any) => j.status === "in-progress") ?? null;
       const scheduled = techJobs.find((j: any) => j.status === "scheduled") ?? null;
       const currentJob = locJob ?? inProgress ?? scheduled;
       const site = currentJob?.site_id ? siteById.get(currentJob.site_id) ?? null : null;

       const techCoords = getLatLngFromAny(loc);
       const siteCoords = getLatLngFromAny(site);
       const distM = techCoords && siteCoords ? distanceMeters(techCoords, siteCoords) : null;
       const arrived = distM != null ? isArrived({ distanceM: distM, accuracyM: (loc as any)?.accuracy }) : false;

      return {
        id: t.id,
        name: t.name,
        loc,
        last,
        isLive,
        site,
        distM,
        arrived,
        techCoords,
      };
    }).sort((a, b) => {
      if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
      const aMs = a.last ? new Date(a.last).getTime() : 0;
      const bMs = b.last ? new Date(b.last).getTime() : 0;
      return bMs - aMs;
    });
  }, [jobs, locationsByTechId, now, siteById, technicians]);

  const liveCount = rows.filter((r) => r.isLive).length;

  return (
    <Card className="bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Live Technician View
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{liveCount}/{technicians.length} live</Badge>
            <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
              <Link to="/dashboard/technicians">All techs</Link>
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {technicians.length === 0 ? (
          <div className="text-sm text-muted-foreground">No technicians yet.</div>
        ) : (
          <div className="space-y-3">
            {rows.slice(0, 6).map((r, idx) => {
              const hasCoords = Boolean(r.techCoords);
              const lat = r.techCoords?.lat ?? null;
              const lng = r.techCoords?.lng ?? null;
              return (
                <div key={r.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full shrink-0",
                            r.isLive ? "bg-emerald-500 animate-pulse" : r.last ? "bg-amber-500" : "bg-muted",
                          )}
                          aria-hidden="true"
                        />
                        <div className="text-sm font-medium truncate">{r.name}</div>
                        {r.isLive ? <Badge className="bg-emerald-600 hover:bg-emerald-600">LIVE</Badge> : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {r.last ? `Updated ${formatDistanceToNowStrict(new Date(r.last))} ago` : "No GPS updates yet"}
                        {hasCoords ? ` · ${lat.toFixed(5)}, ${lng.toFixed(5)}` : ""}
                      </div>
                      {r.site ? (
                        <div className="mt-1 text-xs text-muted-foreground truncate">
                          {r.distM != null ? (
                            r.arrived ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Arrived</span>
                            ) : (
                              <span>{formatDistance(r.distM)} to {r.site.name}</span>
                            )
                          ) : (
                            <span>Site: {r.site.name} (GPS not set)</span>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0">
                      {hasCoords ? (
                        <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                          <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer">
                            Map
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {idx < rows.slice(0, 6).length - 1 ? <Separator className="mt-3" /> : null}
                </div>
              );
            })}
          </div>
        )}

        <div className="text-[11px] text-muted-foreground">
          Tracking updates when technicians keep the dispatch view open on a mobile/touch device (best-effort).
        </div>
      </CardContent>
    </Card>
  );
}

function FinancialTrendsCard({
  jobs,
  technicians,
  inventoryItems,
  jobTimeEntries,
  siteMaterialUsage,
}: {
  jobs: JobCard[];
  technicians: Technician[];
  inventoryItems: InventoryItem[];
  jobTimeEntries: JobTimeEntry[];
  siteMaterialUsage: SiteMaterialUsage[];
}) {
  const techniciansById = React.useMemo(() => new Map(technicians.map((t) => [t.id, t])), [technicians]);
  const inventoryById = React.useMemo(() => new Map(inventoryItems.map((i) => [i.id, i])), [inventoryItems]);

  const timeByJobId = React.useMemo(() => {
    const m = new Map<string, JobTimeEntry[]>();
    for (const e of jobTimeEntries ?? []) {
      if (!e?.job_card_id) continue;
      const arr = m.get(e.job_card_id) ?? [];
      arr.push(e);
      m.set(e.job_card_id, arr);
    }
    return m;
  }, [jobTimeEntries]);

  const materialsByJobId = React.useMemo(() => {
    const m = new Map<string, SiteMaterialUsage[]>();
    for (const u of siteMaterialUsage ?? []) {
      const jobId = u?.job_card_id;
      if (!jobId) continue;
      const arr = m.get(jobId) ?? [];
      arr.push(u);
      m.set(jobId, arr);
    }
    return m;
  }, [siteMaterialUsage]);

  const minutesForEntry = React.useCallback((e: JobTimeEntry) => {
    if (typeof e.minutes === "number" && Number.isFinite(e.minutes)) return Math.max(0, e.minutes);
    if (e.started_at && e.ended_at) {
      const ms = new Date(e.ended_at).getTime() - new Date(e.started_at).getTime();
      if (!Number.isFinite(ms)) return 0;
      return Math.max(0, Math.round(ms / 60_000));
    }
    return 0;
  }, []);

  const series = React.useMemo(() => {
    const DAYS = 14;
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(end);
    start.setDate(start.getDate() - (DAYS - 1));

    const days: { date: Date; key: string; label: string }[] = [];
    const index = new Map<string, number>();
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      index.set(key, i);
      days.push({ date: d, key, label: format(d, "MMM d") });
    }

    const mk = () => days.map((d) => ({ ...d, value: 0 }));
    const revenue = mk();
    const margin = mk();
    const labor = mk();
    const materials = mk();

    const add = (arr: { key: string; value: number }[], dateStr: string | null | undefined, cents: number) => {
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (!Number.isFinite(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const i = index.get(key);
      if (i == null) return;
      arr[i].value += cents;
    };

    for (const j of jobs) {
      if (!["completed", "invoiced"].includes(j.status)) continue;
      const rev = typeof (j as any).revenue_cents === "number" ? (j as any).revenue_cents : 0;
      add(revenue, j.updated_at, rev);

      const p = computeJobProfitability({
        job: j,
        timeEntries: timeByJobId.get(j.id) ?? [],
        materials: materialsByJobId.get(j.id) ?? [],
        techniciansById,
        inventoryById,
      });
      add(margin, j.updated_at, p.grossMarginCents ?? 0);
    }

    for (const e of jobTimeEntries ?? []) {
      const mins = minutesForEntry(e);
      if (mins === 0) continue;
      const techId = e.technician_id ?? null;
      if (!techId) continue;
      const tech: any = techniciansById.get(techId);
      const rate = typeof tech?.hourly_cost_cents === "number" ? tech.hourly_cost_cents : null;
      if (rate == null) continue;
      const cents = Math.round((mins * rate) / 60);
      add(labor, e.ended_at ?? e.started_at, cents);
    }

    for (const u of siteMaterialUsage ?? []) {
      const item: any = inventoryById.get(u.inventory_item_id);
      const unitCost = typeof item?.unit_cost_cents === "number" ? item.unit_cost_cents : null;
      if (unitCost == null) continue;
      const used = typeof u.quantity_used === "number" ? u.quantity_used : 0;
      const wasted = typeof (u as any).quantity_wasted === "number" ? (u as any).quantity_wasted : 0;
      add(materials, u.used_at, Math.round((used + wasted) * unitCost));
    }

    const toChart = (arr: { label: string; value: number }[]) => arr.map((x) => ({ name: x.label, value: x.value }));
    return {
      revenue: toChart(revenue),
      margin: toChart(margin),
      labor: toChart(labor),
      materials: toChart(materials),
    };
  }, [inventoryById, jobTimeEntries, jobs, materialsByJobId, minutesForEntry, siteMaterialUsage, techniciansById, timeByJobId]);

  const summarize = (points: { value: number }[]) => {
    const total = points.reduce((s, p) => s + (p.value ?? 0), 0);
    const mid = Math.floor(points.length / 2);
    const prev = points.slice(0, mid).reduce((s, p) => s + (p.value ?? 0), 0);
    const curr = points.slice(mid).reduce((s, p) => s + (p.value ?? 0), 0);
    const deltaPct = prev !== 0 ? (curr - prev) / Math.abs(prev) : null;
    return { total, prev, curr, deltaPct };
  };

  const cards = React.useMemo(() => {
    const revenue = summarize(series.revenue);
    const margin = summarize(series.margin);
    const labor = summarize(series.labor);
    const materials = summarize(series.materials);
    return [
      { key: "revenue", title: "Revenue", value: formatZarFromCents(revenue.total), deltaPct: revenue.deltaPct, data: series.revenue, stroke: "#0ea5e9" },
      { key: "margin", title: "Profit / Loss", value: formatZarFromCents(margin.total), deltaPct: margin.deltaPct, data: series.margin, stroke: margin.total >= 0 ? "#16a34a" : "#ef4444" },
      { key: "labor", title: "Labor cost", value: formatZarFromCents(labor.total), deltaPct: labor.deltaPct, data: series.labor, stroke: "#a855f7" },
      { key: "materials", title: "Material cost", value: formatZarFromCents(materials.total), deltaPct: materials.deltaPct, data: series.materials, stroke: "#f59e0b" },
    ] as const;
  }, [series]);

  return (
    <Card className="bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Financial Trends (14d)
          </span>
          <div className="text-xs text-muted-foreground">Last 7d vs previous 7d</div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <MiniTrendCard
              key={c.key}
              title={c.title}
              value={c.value}
              deltaPct={c.deltaPct}
              data={c.data}
              stroke={c.stroke}
            />
          ))}
        </div>
        <div className="mt-3 text-[11px] text-muted-foreground">
          Revenue/margin are based on jobs marked Completed/Invoiced; costs are based on time entries and material usage activity.
        </div>
      </CardContent>
    </Card>
  );
}

function MiniTrendCard({
  title,
  value,
  deltaPct,
  data,
  stroke,
}: {
  title: string;
  value: string;
  deltaPct: number | null;
  data: { name: string; value: number }[];
  stroke: string;
}) {
  const deltaLabel = (() => {
    if (deltaPct === null || !Number.isFinite(deltaPct)) return "—";
    const pct = Math.round(deltaPct * 100);
    const sign = pct > 0 ? "+" : "";
    return `${sign}${pct}%`;
  })();

  return (
    <div className="rounded-lg border bg-background/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{title}</div>
          <div className="text-lg font-semibold leading-none mt-1">{value}</div>
        </div>
        <div className={cn("text-xs font-medium", deltaPct == null ? "text-muted-foreground" : deltaPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
          {deltaLabel}
        </div>
      </div>
      <div className="h-14 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="name" hide />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const v = payload[0]?.value as number | undefined;
                const name = payload[0]?.payload?.name as string | undefined;
                if (typeof v !== "number" || !name) return null;
                return (
                  <div className="rounded-md border bg-background px-2 py-1 text-xs shadow-sm">
                    <div className="text-muted-foreground">{name}</div>
                    <div className="font-medium">{formatZarFromCents(v)}</div>
                  </div>
                );
              }}
            />
            <Line type="monotone" dataKey="value" stroke={stroke} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
