import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { isTradeId, type TradeId, TRADES } from "@/features/company-signup/content/trades";
import CreateJobCardDialog from "@/features/dashboard/components/dialogs/create-job-card-dialog";
import SchedulingBoard from "@/features/dashboard/components/dispatch/scheduling-board";
import DispatchRouteMap from "@/features/dashboard/components/dispatch/dispatch-route-map";
import JobCardDetailSheet from "@/features/dashboard/components/job-card-detail-sheet";
import JobStatusBadge from "@/features/dashboard/components/job-status-badge";
import ProfitabilityPill from "@/features/dashboard/components/profitability-pill";
import { computeJobProfitability } from "@/features/dashboard/lib/profitability";
import PageHeader from "@/features/dashboard/components/page-header";
import { KpiCard, DensityProvider } from "@/features/dashboard/components/dashboard-kpi-utils";
import { AiAssistTrigger } from "@/features/ai/components/ai-assist-trigger";
import { useDashboardSelectors } from "@/features/dashboard/hooks/use-dashboard-selectors";
import { useTradeFilter } from "@/features/dashboard/hooks/use-trade-filter";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import type { Database } from "@/integrations/supabase/types";
import { distanceMeters, formatDistance, getLatLngFromAny, isArrived } from "@/lib/geo";
import { format } from "date-fns";
import { Briefcase, CheckCircle2, FileText, MapPin, Plus, RotateCcw, Search } from "lucide-react";
import * as React from "react";

type JobCardStatus = Database["public"]["Enums"]["job_card_status"];
const STATUSES: JobCardStatus[] = ["new", "scheduled", "in-progress", "completed", "invoiced", "cancelled"];

function norm(v: unknown) {
  return String(v ?? "").toLowerCase().trim();
}

export default function Jobs() {
  const { data, actions } = useDashboardData();
  const allowedTradeIds: TradeId[] | null = data.company?.industry && isTradeId(data.company.industry) ? [data.company.industry] : null;
  const { trade } = useTradeFilter(allowedTradeIds);
  const selectors = useDashboardSelectors(data, trade);

  const defaultTradeId = trade === "all" ? TRADES[0].id : trade;
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<JobCardStatus | "all">("all");
  const [view, setView] = React.useState<"list" | "by-site" | "schedule" | "map">("list");
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);

  const openJob = React.useCallback((jobId: string) => {
    setSelectedJobId(jobId);
    setDetailOpen(true);
  }, []);

  const techniciansById = React.useMemo(() => new Map(data.technicians.map((t) => [t.id, t])), [data.technicians]);
  const inventoryById = React.useMemo(() => new Map(data.inventoryItems.map((i) => [i.id, i])), [data.inventoryItems]);
  const locByTechId = React.useMemo(() => {
    const m = new Map<string, any>();
    for (const l of (data.technicianLocations as any[]) ?? []) {
      const tid = l?.technician_id;
      if (!tid) continue;
      m.set(String(tid), l);
    }
    return m;
  }, [data.technicianLocations]);
  const timeByJobId = React.useMemo(() => {
    const m = new Map<string, any[]>();
    for (const e of data.jobTimeEntries) {
      const jobId = e.job_card_id;
      if (!jobId) continue;
      const arr = m.get(jobId) ?? [];
      arr.push(e);
      m.set(jobId, arr);
    }
    return m;
  }, [data.jobTimeEntries]);
  const materialsByJobId = React.useMemo(() => {
    const m = new Map<string, any[]>();
    for (const u of data.siteMaterialUsage) {
      const jobId = u.job_card_id;
      if (!jobId) continue;
      const arr = m.get(jobId) ?? [];
      arr.push(u);
      m.set(jobId, arr);
    }
    return m;
  }, [data.siteMaterialUsage]);

  const matchesQuery = React.useCallback((job: any, q: string) => {
    if (!q) return true;
    const customer = selectors.customersById.get(job.customer_id ?? "");
    const site = job.site_id ? selectors.sitesById.get(job.site_id) : undefined;
    const technician = job.technician_id ? selectors.techniciansById.get(job.technician_id) : undefined;

    const blob = [
      job.title,
      job.description,
      job.status,
      job.trade_id,
      customer?.name,
      site?.name,
      (site as any)?.address,
      technician?.name,
    ]
      .map(norm)
      .join(" ");
    return blob.includes(q);
  }, [selectors.customersById, selectors.sitesById, selectors.techniciansById]);

  const jobsForStats = React.useMemo(() => {
    const q = norm(query);
    return selectors.jobCards.filter((job) => matchesQuery(job as any, q));
  }, [matchesQuery, query, selectors.jobCards]);

  const filteredJobs = React.useMemo(() => {
    const q = norm(query);
    const rows = selectors.jobCards.filter((job) => {
      if (statusFilter !== "all" && job.status !== statusFilter) return false;
      return matchesQuery(job as any, q);
    });

    rows.sort((a, b) => {
      const aSched = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity;
      const bSched = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity;
      if (aSched !== bSched) return aSched - bSched;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return rows;
  }, [query, selectors, statusFilter]);

  const jobsBySite = React.useMemo(() => {
    const m = new Map<string, typeof filteredJobs>();
    const keyFor = (job: any) => String(job.site_id ?? "__no_site__");
    for (const j of filteredJobs) {
      const k = keyFor(j);
      const arr = m.get(k) ?? [];
      arr.push(j);
      m.set(k, arr);
    }
    return m;
  }, [filteredJobs]);

  const stats = React.useMemo(() => {
    const total = jobsForStats.length;
    const newCount = jobsForStats.filter((j) => j.status === "new").length;
    const completedCount = jobsForStats.filter((j) => j.status === "completed").length;
    const invoicedCount = jobsForStats.filter((j) => j.status === "invoiced").length;
    return { total, newCount, completedCount, invoicedCount };
  }, [jobsForStats]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job cards"
        subtitle="Create, assign, and track job cards across all service trades. Search, group, and update jobs fast."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AiAssistTrigger
              label="Ask AI"
              prompt="Review my open job cards and suggest dispatch priorities, risks, and the top next actions for today."
            />
            <CreateJobCardDialog defaultTradeId={defaultTradeId} allowedTradeIds={allowedTradeIds} />
          </div>
        }
      />

      <DensityProvider>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Plus} label="New" value={stats.newCount} accent={stats.newCount > 0 ? "warning" : undefined} href="/dashboard/jobs" />
          <KpiCard icon={CheckCircle2} label="Completed" value={stats.completedCount} />
          <KpiCard icon={FileText} label="Invoiced" value={stats.invoicedCount} />
          <KpiCard icon={Briefcase} label="Total" value={stats.total} />
        </div>
      </DensityProvider>

      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Jobs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="overflow-x-auto">
              <Tabs
                value={view}
                onValueChange={(v) => {
                  if (v === "list" || v === "by-site" || v === "schedule" || v === "map") setView(v);
                }}
              >
                <TabsList className="h-9 w-max">
                  <TabsTrigger value="list">All jobs</TabsTrigger>
                  <TabsTrigger value="by-site">By site</TabsTrigger>
                  <TabsTrigger value="schedule">Dispatch</TabsTrigger>
                  <TabsTrigger value="map">Map</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:flex lg:items-center lg:gap-2">
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search jobs, sites, customers…"
                  className="h-9 pl-9 lg:w-[360px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as JobCardStatus | "all")}>
                <SelectTrigger className="h-9 lg:w-[180px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                className="h-9 justify-start lg:justify-center"
                disabled={!query.trim() && statusFilter === "all"}
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filteredJobs.length}</span> job{filteredJobs.length === 1 ? "" : "s"}.
          </div>
        </CardContent>
      </Card>

      {view === "schedule" ? (
        <SchedulingBoard
          jobs={selectors.jobCards}
          technicians={data.technicians}
          customersById={selectors.customersById}
          sitesById={selectors.sitesById}
          onReschedule={async (jobId, scheduledAt, technicianId) => {
            const patch: any = { scheduled_at: scheduledAt };
            if (technicianId !== undefined) patch.technician_id = technicianId;
            const result = await actions.updateJobCard(jobId, patch);
            if (result) {
              toast({ title: "Job rescheduled" });
            }
          }}
        />
      ) : view === "map" ? (
        <DispatchRouteMap
          jobs={selectors.jobCards}
          technicians={data.technicians}
          techLocations={data.technicianLocations}
          sitesById={selectors.sitesById}
          customersById={selectors.customersById}
        />
      ) : filteredJobs.length === 0 ? (
        <div className="rounded-xl border bg-card/70 backdrop-blur-sm py-10 text-center text-muted-foreground">
          No job cards match your filters.
        </div>
      ) : view === "list" ? (
        <div className="rounded-xl border bg-card/70 backdrop-blur-sm overflow-hidden">
          {/* Mobile: cards (prevents cut-off) */}
          <div className="sm:hidden p-3 space-y-3">
            {filteredJobs.map((job) => {
              const customer = selectors.customersById.get(job.customer_id ?? "");
              const site = job.site_id ? selectors.sitesById.get(job.site_id) : undefined;
              const technician = job.technician_id ? selectors.techniciansById.get(job.technician_id) : undefined;
              const loc = job.technician_id ? locByTechId.get(job.technician_id) ?? null : null;
              const distM = (() => {
                const techCoords = getLatLngFromAny(loc);
                const siteCoords = getLatLngFromAny(site);
                if (!techCoords || !siteCoords) return null;
                return distanceMeters(techCoords, siteCoords);
              })();
              const arrived = distM != null ? isArrived({ distanceM: distM, accuracyM: (loc as any)?.accuracy }) : false;
              const profitability = computeJobProfitability({
                job,
                timeEntries: timeByJobId.get(job.id) ?? [],
                materials: materialsByJobId.get(job.id) ?? [],
                techniciansById,
                inventoryById,
              });
              return (
                <Card key={job.id} className="bg-background/50">
                  <CardContent className="py-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold leading-tight break-words">{job.title}</div>
                        <div className="text-xs text-muted-foreground whitespace-normal break-words">{job.description ?? "—"}</div>
                      </div>
                      <JobStatusBadge status={job.status} />
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1">
                      <div><span className="font-medium text-foreground">Trade:</span> {TRADES.find((t) => t.id === job.trade_id)?.shortName ?? job.trade_id}</div>
                      <div><span className="font-medium text-foreground">Customer:</span> {customer?.name ?? "—"}</div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span className="font-medium text-foreground">{site?.name ?? "—"}</span>
                      </div>
                      {site ? <div className="whitespace-normal break-words">{(site as any)?.address ?? site.address ?? "No address"}</div> : null}
                      {site && job.technician_id ? (
                        <div className="text-[11px] text-muted-foreground">
                          {distM != null ? (arrived ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">Arrived</span> : <span>{formatDistance(distM)} away</span>) : "Distance unavailable"}
                        </div>
                      ) : null}
                      <div><span className="font-medium text-foreground">Technician:</span> {technician?.name ?? "Unassigned"}</div>
                      <div><span className="font-medium text-foreground">Scheduled:</span> {job.scheduled_at ? format(new Date(job.scheduled_at), "PPp") : "—"}</div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <ProfitabilityPill value={profitability} />
                      <Button size="sm" variant="outline" onClick={() => openJob(job.id)}>
                        Open
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop: table (no truncation, horizontal scroll if needed) */}
          <div className="hidden sm:block overflow-x-auto">
            <div className="min-w-[1100px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[380px]">Job</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="w-[320px]">Site</TableHead>
                    <TableHead>Technician</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Gross margin</TableHead>
                    <TableHead className="w-[120px]">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => {
                    const customer = selectors.customersById.get(job.customer_id ?? "");
                    const site = job.site_id ? selectors.sitesById.get(job.site_id) : undefined;
                    const technician = job.technician_id ? selectors.techniciansById.get(job.technician_id) : undefined;
                    const loc = job.technician_id ? locByTechId.get(job.technician_id) ?? null : null;
                    const distM = (() => {
                      const techCoords = getLatLngFromAny(loc);
                      const siteCoords = getLatLngFromAny(site);
                      if (!techCoords || !siteCoords) return null;
                      return distanceMeters(techCoords, siteCoords);
                    })();
                    const arrived = distM != null ? isArrived({ distanceM: distM, accuracyM: (loc as any)?.accuracy }) : false;
                    const profitability = computeJobProfitability({
                      job,
                      timeEntries: timeByJobId.get(job.id) ?? [],
                      materials: materialsByJobId.get(job.id) ?? [],
                      techniciansById,
                      inventoryById,
                    });
                    return (
                      <TableRow
                        key={job.id}
                        className="align-top cursor-pointer hover:bg-muted/30"
                        onClick={() => openJob(job.id)}
                      >
                        <TableCell>
                          <div className="font-medium whitespace-normal break-words">{job.title}</div>
                          <div className="text-xs text-muted-foreground whitespace-normal break-words mt-1">{job.description || "—"}</div>
                        </TableCell>
                        <TableCell>
                          <JobStatusBadge status={job.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {TRADES.find((t) => t.id === job.trade_id)?.shortName ?? job.trade_id}
                        </TableCell>
                        <TableCell className="whitespace-normal break-words">{customer?.name ?? "—"}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium whitespace-normal break-words">{site?.name ?? "—"}</div>
                            <div className="text-xs text-muted-foreground whitespace-normal break-words flex items-start gap-1">
                              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                              <span>{(site as any)?.address ?? site?.address ?? "No address"}</span>
                            </div>
                            {site && job.technician_id ? (
                              <div className="text-[11px] text-muted-foreground">
                                {distM != null ? (
                                  arrived ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Arrived</span>
                                  ) : (
                                    <span>{formatDistance(distM)} away</span>
                                  )
                                ) : (
                                  <span>Distance unavailable</span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-normal break-words">{technician?.name ?? "Unassigned"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {job.scheduled_at ? format(new Date(job.scheduled_at), "PPp") : "—"}
                        </TableCell>
                        <TableCell>
                          <ProfitabilityPill value={profitability} />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              openJob(job.id);
                            }}
                          >
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      ) : (
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Jobs by site</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {[...jobsBySite.entries()]
                .sort(([a], [b]) => {
                  if (a === "__no_site__") return 1;
                  if (b === "__no_site__") return -1;
                  const aName = selectors.sitesById.get(a)?.name ?? "";
                  const bName = selectors.sitesById.get(b)?.name ?? "";
                  return aName.localeCompare(bName);
                })
                .map(([siteId, jobs]) => {
                  const site = siteId === "__no_site__" ? null : selectors.sitesById.get(siteId) ?? null;
                  const title = site ? site.name : "No site set";
                  const address = site ? ((site as any)?.address ?? site.address ?? null) : null;
                  return (
                    <AccordionItem key={siteId} value={siteId}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="min-w-0 flex-1 text-left">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium whitespace-normal break-words">{title}</div>
                            <Badge variant="secondary">{jobs.length}</Badge>
                          </div>
                          {address ? (
                            <div className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                              <span className="whitespace-normal break-words">{address}</span>
                            </div>
                          ) : null}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          {/* Desktop: table per site */}
                          <div className="hidden sm:block overflow-x-auto">
                            <div className="min-w-[980px]">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[360px]">Job</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Technician</TableHead>
                                    <TableHead>Scheduled</TableHead>
                                    <TableHead>Gross margin</TableHead>
                                    <TableHead className="w-[120px]">Open</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {jobs.map((job) => {
                                    const technician = job.technician_id ? selectors.techniciansById.get(job.technician_id) : undefined;
                                    const profitability = computeJobProfitability({
                                      job,
                                      timeEntries: timeByJobId.get(job.id) ?? [],
                                      materials: materialsByJobId.get(job.id) ?? [],
                                      techniciansById,
                                      inventoryById,
                                    });
                                    return (
                                      <TableRow
                                        key={job.id}
                                        className="align-top cursor-pointer hover:bg-muted/30"
                                        onClick={() => openJob(job.id)}
                                      >
                                        <TableCell>
                                          <div className="font-medium whitespace-normal break-words">{job.title}</div>
                                          <div className="text-xs text-muted-foreground whitespace-normal break-words mt-1">{job.description || "—"}</div>
                                        </TableCell>
                                        <TableCell><JobStatusBadge status={job.status} /></TableCell>
                                        <TableCell className="whitespace-normal break-words">{technician?.name ?? "Unassigned"}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                          {job.scheduled_at ? format(new Date(job.scheduled_at), "PPp") : "—"}
                                        </TableCell>
                                        <TableCell><ProfitabilityPill value={profitability} /></TableCell>
                                        <TableCell>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openJob(job.id);
                                            }}
                                          >
                                            Open
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>

                          {/* Mobile: cards per site */}
                          <div className="sm:hidden space-y-3">
                            {jobs.map((job) => {
                              const technician = job.technician_id ? selectors.techniciansById.get(job.technician_id) : undefined;
                              const profitability = computeJobProfitability({
                                job,
                                timeEntries: timeByJobId.get(job.id) ?? [],
                                materials: materialsByJobId.get(job.id) ?? [],
                                techniciansById,
                                inventoryById,
                              });
                              return (
                                <Card key={job.id} className="bg-background/50">
                                  <CardContent className="py-4 space-y-2">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="font-semibold leading-tight break-words">{job.title}</div>
                                        <div className="text-xs text-muted-foreground whitespace-normal break-words">{job.description ?? "—"}</div>
                                      </div>
                                      <JobStatusBadge status={job.status} />
                                    </div>
                                    <div className="text-xs text-muted-foreground space-y-1">
                                      <div><span className="font-medium text-foreground">Technician:</span> {technician?.name ?? "Unassigned"}</div>
                                      <div><span className="font-medium text-foreground">Scheduled:</span> {job.scheduled_at ? format(new Date(job.scheduled_at), "PPp") : "—"}</div>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 pt-1">
                                      <ProfitabilityPill value={profitability} />
                                      <Button size="sm" variant="outline" onClick={() => openJob(job.id)}>
                                        Open
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
            </Accordion>
          </CardContent>
        </Card>
      )}

      <JobCardDetailSheet
        jobId={selectedJobId}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setSelectedJobId(null);
        }}
      />
    </div>
  );
}
