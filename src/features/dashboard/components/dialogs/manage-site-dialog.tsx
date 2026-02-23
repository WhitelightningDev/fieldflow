import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import JobStatusBadge from "@/features/dashboard/components/job-status-badge";
import JobSiteControlsDialog from "@/features/dashboard/components/dialogs/job-site-controls-dialog";
import type { Tables } from "@/integrations/supabase/types";
import { formatZarFromCents } from "@/lib/money";
import { supabase as _supabase } from "@/integrations/supabase/client";
import { formatDistanceToNowStrict } from "date-fns";
import { FileText, MapPin, Receipt, Users } from "lucide-react";
import * as React from "react";

type Site = Tables<"sites">;
type JobCard = Tables<"job_cards">;
type Technician = Tables<"technicians">;
type InventoryItem = Tables<"inventory_items">;
type SiteMaterialUsage = Tables<"site_material_usage">;
type SiteTeamAssignment = Tables<"site_team_assignments">;
type Team = Tables<"teams">;
type TeamMember = Tables<"team_members">;

type JobTimeEntry = {
  id: string;
  job_card_id: string;
  technician_id: string | null;
  started_at: string;
  ended_at: string | null;
  minutes: number | null;
  notes: string | null;
};

type SiteDocument = {
  id: string;
  site_id: string;
  kind: string;
  title: string;
  created_at: string;
};

type JobPhoto = {
  id: string;
  job_card_id: string;
  kind: string;
  created_at: string;
};

const supabase = _supabase as any;

function centsOrZero(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function minutesForEntry(e: JobTimeEntry) {
  if (typeof e.minutes === "number" && Number.isFinite(e.minutes)) return Math.max(0, e.minutes);
  const start = new Date(e.started_at).getTime();
  const end = e.ended_at ? new Date(e.ended_at).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 60_000));
}

function formatHours(mins: number) {
  const h = mins / 60;
  return h >= 10 ? h.toFixed(0) + "h" : h.toFixed(1) + "h";
}

function getCurrentAssignment(assignments: SiteTeamAssignment[]) {
  const now = Date.now();
  const active = assignments
    .filter((a) => {
      const start = new Date((a as any).starts_at ?? (a as any).assigned_at ?? a.created_at).getTime();
      const end = (a as any).ends_at ? new Date((a as any).ends_at).getTime() : Infinity;
      return start <= now && end >= now;
    })
    .sort((a, b) => new Date((b as any).starts_at ?? (b as any).assigned_at ?? b.created_at).getTime() - new Date((a as any).starts_at ?? (a as any).assigned_at ?? a.created_at).getTime());
  return active[0] ?? null;
}

export default function ManageSiteDialog({ siteId }: { siteId: string }) {
  const { data, actions } = useDashboardData();
  const [open, setOpen] = React.useState(false);
  const [docs, setDocs] = React.useState<SiteDocument[]>([]);
  const [photos, setPhotos] = React.useState<JobPhoto[]>([]);
  const [loading, setLoading] = React.useState(false);

  const site = data.sites.find((s) => s.id === siteId) as Site | undefined;
  const customer = site && (site as any).customer_id ? data.customers.find((c) => c.id === (site as any).customer_id) : null;

  const jobs = React.useMemo(() => {
    return data.jobCards
      .filter((j) => (j as any).site_id === siteId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [data.jobCards, siteId]);

  const jobIds = React.useMemo(() => jobs.map((j) => j.id), [jobs]);
  const jobIdSet = React.useMemo(() => new Set(jobIds), [jobIds]);

  const timeEntries = React.useMemo(() => {
    return (data.jobTimeEntries as JobTimeEntry[]).filter((e) => jobIdSet.has(e.job_card_id));
  }, [data.jobTimeEntries, jobIdSet]);

  const materials = React.useMemo(() => {
    return (data.siteMaterialUsage as SiteMaterialUsage[]).filter((u) => u.site_id === siteId);
  }, [data.siteMaterialUsage, siteId]);

  const techniciansById = React.useMemo(() => new Map(data.technicians.map((t) => [t.id, t])), [data.technicians]);
  const inventoryById = React.useMemo(() => new Map(data.inventoryItems.map((i) => [i.id, i])), [data.inventoryItems]);

  const currentAssignment = React.useMemo(() => {
    const assignments = (data.siteTeamAssignments as SiteTeamAssignment[]).filter((a) => a.site_id === siteId);
    return getCurrentAssignment(assignments);
  }, [data.siteTeamAssignments, siteId]);

  const currentTeam = React.useMemo(() => {
    if (!currentAssignment) return null;
    return (data.teams as Team[]).find((t) => t.id === currentAssignment.team_id) ?? null;
  }, [currentAssignment, data.teams]);

  const currentTeamNames = React.useMemo(() => {
    if (!currentAssignment) return [];
    const members = (data.teamMembers as TeamMember[]).filter((m) => m.team_id === currentAssignment.team_id);
    return members.map((m) => m.full_name).filter(Boolean) as string[];
  }, [currentAssignment, data.teamMembers]);

  const metrics = React.useMemo(() => {
    const activeJobs = jobs.filter((j) => !["completed", "invoiced", "cancelled"].includes(j.status));
    const unbilledJobs = jobs.filter((j) => j.status === "completed");
    const invoicedJobs = jobs.filter((j) => j.status === "invoiced");

    const unbilledRevenue = unbilledJobs.reduce((sum, j) => sum + centsOrZero((j as any).revenue_cents), 0);
    const totalRevenue = jobs.reduce((sum, j) => sum + centsOrZero((j as any).revenue_cents), 0);

    const techWorked = new Set<string>();
    for (const j of jobs) {
      const tid = (j as any).technician_id;
      if (typeof tid === "string" && tid) techWorked.add(tid);
    }
    for (const e of timeEntries) {
      if (e.technician_id) techWorked.add(e.technician_id);
    }

    const onSiteTechs = new Set<string>();
    timeEntries.filter((e) => !e.ended_at && e.technician_id).forEach((e) => onSiteTechs.add(e.technician_id!));
    if (onSiteTechs.size === 0) {
      jobs.filter((j) => j.status === "in-progress" && (j as any).technician_id).forEach((j) => onSiteTechs.add((j as any).technician_id));
    }

    const minsByTech = new Map<string, number>();
    for (const e of timeEntries) {
      const tid = e.technician_id;
      if (!tid) continue;
      minsByTech.set(tid, (minsByTech.get(tid) ?? 0) + minutesForEntry(e));
    }

    const used = materials.reduce((s, u) => s + (u.quantity_used ?? 0), 0);
    const wasted = materials.reduce((s, u) => s + ((u as any).quantity_wasted ?? 0), 0);

    return {
      activeJobs,
      unbilledJobs,
      invoicedJobs,
      unbilledRevenue,
      totalRevenue,
      techWorkedCount: techWorked.size,
      onSiteTechIds: [...onSiteTechs],
      minsByTech,
      used,
      wasted,
    };
  }, [jobs, materials, timeEntries]);

  React.useEffect(() => {
    if (!open) return;
    if (!site) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [docRes, photoRes] = await Promise.all([
        supabase.from("site_documents").select("id,site_id,kind,title,created_at").eq("site_id", siteId).order("created_at", { ascending: false }),
        jobIds.length > 0
          ? supabase.from("job_photos").select("id,job_card_id,kind,created_at").in("job_card_id", jobIds).order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;
      setDocs((docRes?.data as SiteDocument[]) ?? []);
      setPhotos((photoRes?.data as JobPhoto[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [jobIds, open, site, siteId]);

  if (!site) return null;

  const onSiteNames = metrics.onSiteTechIds
    .map((id) => techniciansById.get(id)?.name)
    .filter(Boolean) as string[];

  const scope = (site as any).scope_of_work as string | null | undefined;
  const billingReference = (site as any).billing_reference as string | null | undefined;
  const code = (site as any).code as string | null | undefined;
  const gpsLat = (site as any).gps_lat as number | null | undefined;
  const gpsLng = (site as any).gps_lng as number | null | undefined;
  const hasGps = typeof gpsLat === "number" && Number.isFinite(gpsLat) && typeof gpsLng === "number" && Number.isFinite(gpsLng);

  const photosByJobId = React.useMemo(() => {
    const m = new Map<string, { before: number; after: number }>();
    for (const p of photos) {
      const current = m.get(p.job_card_id) ?? { before: 0, after: 0 };
      if (p.kind === "after") current.after += 1;
      else current.before += 1;
      m.set(p.job_card_id, current);
    }
    return m;
  }, [photos]);

  const docsByKind = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const d of docs) m.set(d.kind, (m.get(d.kind) ?? 0) + 1);
    return m;
  }, [docs]);

  const materialsByItem = React.useMemo(() => {
    const m = new Map<string, { used: number; wasted: number }>();
    for (const u of materials) {
      const itemId = u.inventory_item_id;
      const row = m.get(itemId) ?? { used: 0, wasted: 0 };
      row.used += u.quantity_used ?? 0;
      row.wasted += (u as any).quantity_wasted ?? 0;
      m.set(itemId, row);
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, ...v, name: inventoryById.get(id)?.name ?? "Unknown item" }))
      .sort((a, b) => b.used + b.wasted - (a.used + a.wasted));
  }, [inventoryById, materials]);

  const labourByTech = React.useMemo(() => {
    const rows = [...metrics.minsByTech.entries()]
      .map(([id, mins]) => ({ id, mins, name: techniciansById.get(id)?.name ?? "Unknown tech" }))
      .sort((a, b) => b.mins - a.mins);
    return rows;
  }, [metrics.minsByTech, techniciansById]);

  const markInvoiced = async (jobId: string) => {
    await actions.setJobCardStatus(jobId, "invoiced");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Manage
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">{site.name}</span>
            <div className="flex items-center gap-2 shrink-0">
              {code ? <Badge variant="secondary">{code}</Badge> : null}
              {billingReference ? <Badge variant="outline">{billingReference}</Badge> : null}
            </div>
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {customer ? <span>{customer.name}</span> : <span className="text-muted-foreground">No customer</span>}
              <span className="text-muted-foreground">•</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {(site as any).address ?? "No address"}
              </span>
            </div>
            {hasGps ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>GPS {gpsLat.toFixed(5)}, {gpsLng.toFixed(5)}</span>
                <span className="text-muted-foreground">•</span>
                <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href={`https://www.google.com/maps?q=${gpsLat},${gpsLng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open map
                </a>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                No GPS coordinates saved for this site yet (add them in Edit site to enable distance/arrival tracking).
              </div>
            )}
            {scope ? <div className="text-xs text-muted-foreground line-clamp-2">{scope}</div> : null}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full flex-1 min-h-0 overflow-hidden flex flex-col">
          <TabsList className="shrink-0 w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="jobs">Jobs & Invoices</TabsTrigger>
            <TabsTrigger value="labour">Who Worked</TabsTrigger>
            <TabsTrigger value="materials">Materials</TabsTrigger>
            <TabsTrigger value="docs">Docs / Photos</TabsTrigger>
          </TabsList>

          <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-card/70 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                      <Users className="h-4 w-4" /> Currently on site
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.onSiteTechIds.length}</div>
                    <div className="text-xs text-muted-foreground">{onSiteNames.length ? onSiteNames.join(", ") : currentTeamNames.length ? currentTeamNames.join(", ") : "—"}</div>
                    {currentTeam ? (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        Team: {currentTeam.name} {currentTeamNames.length ? `(${currentTeamNames.length})` : ""}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card className="bg-card/70 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                      <Receipt className="h-4 w-4" /> Unbilled (completed)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatZarFromCents(metrics.unbilledRevenue)}</div>
                    <div className="text-xs text-muted-foreground">{metrics.unbilledJobs.length} job{metrics.unbilledJobs.length === 1 ? "" : "s"}</div>
                  </CardContent>
                </Card>

                <Card className="bg-card/70 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                      <Users className="h-4 w-4" /> Techs who worked
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.techWorkedCount}</div>
                    <div className="text-xs text-muted-foreground">based on jobs + time logs</div>
                  </CardContent>
                </Card>

                <Card className="bg-card/70 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Site activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{jobs.length}</div>
                    <div className="text-xs text-muted-foreground">
                      {metrics.activeJobs.length} active · {metrics.invoicedJobs.length} invoiced
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-xl border bg-card/70 backdrop-blur-sm p-4 text-sm">
                <div className="font-medium">What’s being done here</div>
                <div className="mt-1 text-muted-foreground">
                  {scope ? scope : jobs.length ? `From job cards: ${jobs.slice(0, 3).map((j) => j.title).join(" · ")}` : "Add a site scope and create job cards to segment work + invoices."}
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div>
                    <div className="font-medium text-foreground">Materials</div>
                    <div>
                      Used {metrics.used} · Wasted {metrics.wasted}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Updated</div>
                    <div>{formatDistanceToNowStrict(new Date(site.updated_at), { addSuffix: true })}</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="jobs" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="bg-card/70 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                      <Receipt className="h-4 w-4" /> Unbilled
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{formatZarFromCents(metrics.unbilledRevenue)}</div>
                    <div className="text-xs text-muted-foreground">{metrics.unbilledJobs.length} completed</div>
                  </CardContent>
                </Card>
                <Card className="bg-card/70 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                      <Receipt className="h-4 w-4" /> Invoiced
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{metrics.invoicedJobs.length}</div>
                    <div className="text-xs text-muted-foreground">jobs invoiced</div>
                  </CardContent>
                </Card>
                <Card className="bg-card/70 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                      <Receipt className="h-4 w-4" /> Total (jobs)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{formatZarFromCents(metrics.totalRevenue)}</div>
                    <div className="text-xs text-muted-foreground">{jobs.length} segmented job cards</div>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead className="w-[240px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                          No job cards for this site yet. Create job cards to segment work and invoices per site.
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {jobs.map((j) => {
                      const tid = (j as any).technician_id as string | null;
                      const techName = tid ? (techniciansById.get(tid) as Technician | undefined)?.name : null;
                      const revenue = centsOrZero((j as any).revenue_cents);
                      return (
                        <TableRow key={j.id}>
                          <TableCell>
                            <div className="font-medium">{j.title}</div>
                            <div className="text-xs text-muted-foreground">
                              Updated {formatDistanceToNowStrict(new Date(j.updated_at), { addSuffix: true })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <JobStatusBadge status={j.status} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{techName ?? "—"}</TableCell>
                          <TableCell className="text-sm">{revenue ? formatZarFromCents(revenue) : "—"}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <JobSiteControlsDialog jobId={j.id} />
                            {j.status === "completed" ? (
                              <Button size="sm" variant="secondary" onClick={() => markInvoiced(j.id)}>
                                Mark invoiced
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="labour" className="space-y-4">
              <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Technician</TableHead>
                      <TableHead>Total time</TableHead>
                      <TableHead>Currently on site</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {labourByTech.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                          No time tracking entries yet. Use the Job Controls dialog to start/stop time per job.
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {labourByTech.map((r) => {
                      const isOnSite = metrics.onSiteTechIds.includes(r.id);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell>{formatHours(r.mins)}</TableCell>
                          <TableCell>
                            {isOnSite ? <Badge>On site</Badge> : <Badge variant="outline">—</Badge>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="materials" className="space-y-4">
              <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Used</TableHead>
                      <TableHead>Wasted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialsByItem.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                          No material usage yet. Record materials (and wastage) in Job Controls.
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {materialsByItem.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.used}</TableCell>
                        <TableCell>{r.wasted}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="docs" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-card/70 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Documents</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">COC</span>
                      <Badge variant="secondary">{docsByKind.get("coc") ?? 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Other</span>
                      <Badge variant="secondary">{docs.length - (docsByKind.get("coc") ?? 0)}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Upload and manage documents inside Job Controls (COC is stored per site).
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/70 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Photos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Before / After</span>
                      <Badge variant="secondary">
                        {photos.filter((p) => p.kind !== "after").length} / {photos.filter((p) => p.kind === "after").length}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">Photo totals are aggregated from job cards on this site.</div>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Photos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground py-10">
                          No jobs yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {jobs.map((j) => {
                      const counts = photosByJobId.get(j.id) ?? { before: 0, after: 0 };
                      return (
                        <TableRow key={j.id}>
                          <TableCell className="font-medium">{j.title}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {counts.before} before · {counts.after} after
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {loading ? <div className="text-xs text-muted-foreground">Loading docs/photos…</div> : null}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="shrink-0 pt-4">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
