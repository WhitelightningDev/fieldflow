import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import JobStatusBadge from "@/features/dashboard/components/job-status-badge";
import PageHeader from "@/features/dashboard/components/page-header";
import { KpiCard, DensityProvider } from "@/features/dashboard/components/dashboard-kpi-utils";
import CreateServiceCallDialog from "@/features/dashboard/components/dialogs/create-service-call-dialog";
import ServiceCallDispatchDialog from "@/features/dashboard/components/dialogs/service-call-dispatch-dialog";
import JobSiteControlsDialog from "@/features/dashboard/components/dialogs/job-site-controls-dialog";
import RowActionsMenu from "@/components/row-actions-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { extractTags, hasTag } from "@/features/dashboard/lib/service-calls";
import { isAfterHours, isLast24h, isThisMonth } from "@/features/dashboard/components/dashboard-kpi-utils";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import type { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { AlertTriangle, Flame, Gauge, Phone, RefreshCcw, Shield, Timer, UserX } from "lucide-react";
import * as React from "react";
import { useSearchParams } from "react-router-dom";

export default function ServiceCalls() {
  const { data, actions } = useDashboardData();
  const [searchParams] = useSearchParams();

  type JobCardStatus = Database["public"]["Enums"]["job_card_status"];
  const STATUSES: JobCardStatus[] = ["new", "scheduled", "in-progress", "completed", "invoiced", "cancelled"];
  const URGENCY: Array<{ value: string; label: string }> = [
    { value: "all", label: "All urgency" },
    { value: "normal", label: "Normal" },
    { value: "urgent", label: "Urgent" },
    { value: "emergency", label: "Emergency" },
  ];

  const [query, setQuery] = React.useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = React.useState<JobCardStatus | "all">(() => {
    const raw = searchParams.get("status");
    return raw && STATUSES.includes(raw as any) ? (raw as any) : "all";
  });
  const [urgencyFilter, setUrgencyFilter] = React.useState<string>(() => {
    const raw = searchParams.get("urgency");
    return raw === "normal" || raw === "urgent" || raw === "emergency" ? raw : "all";
  });
  const [scope, setScope] = React.useState<"service-calls" | "all-plumbing">(() => {
    const raw = searchParams.get("scope");
    return raw === "all-plumbing" ? "all-plumbing" : "service-calls";
  });

  const jobs = React.useMemo(() => data.jobCards.filter((j) => j.trade_id === "plumbing"), [data.jobCards]);

  const jobsWithTags = React.useMemo(() => {
    return jobs.map((j) => ({ job: j, tags: extractTags(j.notes) }));
  }, [jobs]);

  const norm = React.useCallback((v: unknown) => String(v ?? "").toLowerCase().trim(), []);

  const matches = React.useCallback(
    (row: { job: any; tags: Set<string> }, q: string) => {
      if (!q) return true;
      const job = row.job;
      const customer = data.customers.find((c) => c.id === (job.customer_id ?? "")) as any;
      const site = job.site_id ? data.sites.find((s) => s.id === job.site_id) : null;
      const tech = job.technician_id ? data.technicians.find((t) => t.id === job.technician_id) : null;

      const blob = [
        job.title,
        job.description,
        job.status,
        job.priority,
        customer?.name,
        customer?.phone,
        (site as any)?.name,
        (site as any)?.address,
        tech?.name,
        tech?.phone,
        job.notes,
        Array.from(row.tags).join(" "),
      ]
        .map(norm)
        .join(" ");
      return blob.includes(q);
    },
    [data.customers, data.sites, data.technicians, norm],
  );

  const filtered = React.useMemo(() => {
    const q = norm(query);
    let rows = jobsWithTags;
    if (scope === "service-calls") rows = rows.filter((r) => hasTag(r.tags, "service-call"));
    if (statusFilter !== "all") rows = rows.filter((r) => r.job.status === statusFilter);
    if (urgencyFilter !== "all") rows = rows.filter((r) => String(r.job.priority ?? "normal") === urgencyFilter);
    rows = rows.filter((r) => matches(r, q));

    rows.sort((a, b) => {
      const aSched = a.job.scheduled_at ? new Date(a.job.scheduled_at).getTime() : Infinity;
      const bSched = b.job.scheduled_at ? new Date(b.job.scheduled_at).getTime() : Infinity;
      if (aSched !== bSched) return aSched - bSched;
      return new Date(b.job.created_at).getTime() - new Date(a.job.created_at).getTime();
    });
    return rows;
  }, [jobsWithTags, matches, norm, query, scope, statusFilter, urgencyFilter]);

  const stats = React.useMemo(() => {
    const serviceCalls = jobsWithTags.filter((r) => hasTag(r.tags, "service-call"));
    const emergencyToday = serviceCalls.filter((r) => isLast24h(r.job.created_at) && (r.job.priority === "urgent" || r.job.priority === "emergency"));
    const inProgress = serviceCalls.filter((r) => r.job.status === "in-progress");
    const unassigned = serviceCalls.filter((r) => !r.job.technician_id && (r.job.status === "new" || r.job.status === "scheduled"));
    const afterHoursMonth = serviceCalls.filter((r) => isThisMonth(r.job.created_at) && (hasTag(r.tags, "after-hours") || (r.job.scheduled_at && isAfterHours(r.job.scheduled_at))));
    const gasCoc = serviceCalls.filter((r) => hasTag(r.tags, "gas-coc") && r.job.status !== "invoiced" && r.job.status !== "cancelled");
    const pressure = serviceCalls.filter((r) => hasTag(r.tags, "pressure-test") && r.job.status !== "invoiced" && r.job.status !== "cancelled");
    return {
      total: serviceCalls.length,
      emergencyToday: emergencyToday.length,
      inProgress: inProgress.length,
      unassigned: unassigned.length,
      afterHoursMonth: afterHoursMonth.length,
      gasCocOpen: gasCoc.length,
      pressureOpen: pressure.length,
    };
  }, [jobsWithTags]);

  const company = data.company as any;
  const calloutFee = company?.callout_fee_cents ? Number(company.callout_fee_cents) : null;
  const radiusKm = company?.callout_radius_km ? Number(company.callout_radius_km) : null;
  const subtitle = [
    "Plumbing call-outs, emergencies, compliance flags, and dispatch control.",
    Number.isFinite(calloutFee) ? `Call-out fee R${(calloutFee! / 100).toFixed(0)}` : null,
    Number.isFinite(radiusKm) ? `${radiusKm}km radius` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <div data-tour="servicecalls-header">
        <PageHeader
          title="Service calls"
          subtitle={subtitle}
          actions={
            <>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void actions.refreshData()}>
                <RefreshCcw className="h-4 w-4" /> Refresh
              </Button>
              <CreateServiceCallDialog />
            </>
          }
        />
      </div>

      <DensityProvider>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-6" data-tour="servicecalls-stats">
          <KpiCard icon={Phone} label="Service calls" value={stats.total} />
          <KpiCard icon={Flame} label="Emergency (24h)" value={stats.emergencyToday} accent={stats.emergencyToday > 0 ? "destructive" : undefined} />
          <KpiCard icon={Gauge} label="In progress" value={stats.inProgress} />
          <KpiCard icon={UserX} label="Unassigned" value={stats.unassigned} accent={stats.unassigned > 0 ? "warning" : undefined} />
          <KpiCard icon={Shield} label="Gas CoC (open)" value={stats.gasCocOpen} accent={stats.gasCocOpen > 0 ? "warning" : undefined} />
          <KpiCard icon={AlertTriangle} label="Pressure tests" value={stats.pressureOpen} accent={stats.pressureOpen > 0 ? "warning" : undefined} />
        </div>
      </DensityProvider>

      <Card className="bg-card/70 backdrop-blur-sm" data-tour="servicecalls-filters">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer, address, tags, notes…" />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="h-9">
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
            <Select value={urgencyFilter} onValueChange={(v) => setUrgencyFilter(v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {URGENCY.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={scope} onValueChange={(v) => setScope(v as any)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service-calls">Only #service-call</SelectItem>
                <SelectItem value="all-plumbing">All plumbing jobs</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground">
            Tip: Log calls using <span className="font-medium text-foreground">Log service call</span> so compliance flags become searchable #tags.
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border bg-card/70 backdrop-blur-sm overflow-hidden" data-tour="servicecalls-table">
        <div className="hidden sm:block overflow-x-auto">
          <div className="min-w-[1200px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Logged</TableHead>
                  <TableHead className="w-[170px]">Dispatch</TableHead>
                  <TableHead className="w-[120px]">Urgency</TableHead>
                  <TableHead className="w-[260px]">Customer</TableHead>
                  <TableHead className="w-[320px]">Site / Address</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="w-[200px]">Technician</TableHead>
                  <TableHead className="w-[280px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                      No service calls match your filters.
                    </TableCell>
                  </TableRow>
                ) : null}
                {filtered.map(({ job, tags }) => {
                  const customer = data.customers.find((c) => c.id === (job.customer_id ?? "")) as any;
                  const site = job.site_id ? data.sites.find((s) => s.id === job.site_id) : null;
                  const tech = job.technician_id ? data.technicians.find((t) => t.id === job.technician_id) : null;
                  const address = (site as any)?.address ?? "";
                  const afterHours = hasTag(tags, "after-hours") || (job.scheduled_at ? isAfterHours(job.scheduled_at) : false);

                  const chip = (t: string, label?: string) => (
                    <Badge key={t} variant="secondary" className="capitalize">
                      {label ?? t.replace(/-/g, " ")}
                    </Badge>
                  );

                  const chips: React.ReactNode[] = [];
                  if (afterHours) chips.push(chip("after-hours", "After-hours"));
                  if (hasTag(tags, "gas-coc")) chips.push(chip("gas-coc", "Gas CoC"));
                  if (hasTag(tags, "pressure-test")) chips.push(chip("pressure-test", "Pressure test"));
                  if (hasTag(tags, "pirb-coc")) chips.push(chip("pirb-coc", "PIRB CoC"));

                  return (
                    <TableRow key={job.id} className="align-top">
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="space-y-0.5">
                          <div className="font-medium text-foreground">{format(new Date(job.created_at), "EEE, MMM d")}</div>
                          <div>{format(new Date(job.created_at), "p")}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {job.scheduled_at ? (
                          <div className="space-y-0.5">
                            <div className="font-medium text-foreground">{format(new Date(job.scheduled_at), "EEE, MMM d")}</div>
                            <div>{format(new Date(job.scheduled_at), "p")}</div>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 text-muted-foreground">
                            <Timer className="h-3.5 w-3.5" /> Not scheduled
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={job.priority === "emergency" ? "destructive" : "secondary"}
                          className="capitalize"
                        >
                          {String(job.priority ?? "normal")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{customer?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{customer?.phone ?? customer?.billing_phone ?? "—"}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium truncate">{site?.name ?? "No site"}</div>
                        <div className="text-xs text-muted-foreground truncate">{address || "Use Address field in dispatch notes"}</div>
                        {chips.length ? <div className="mt-1 flex flex-wrap gap-1">{chips}</div> : null}
                      </TableCell>
                      <TableCell className="min-w-[320px]">
                        <div className="font-medium">{job.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{job.description ?? "—"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <JobStatusBadge status={job.status} />
                          {afterHours ? <Badge variant="secondary">After-hours</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{tech?.name ?? "Unassigned"}</div>
                        <div className="text-xs text-muted-foreground">{tech?.phone ?? "—"}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <Select value={job.status} onValueChange={(v) => actions.setJobCardStatus(job.id, v as JobCardStatus)}>
                            <SelectTrigger className="h-9 w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <RowActionsMenu label="Service call actions">
                            <ServiceCallDispatchDialog job={job as any} trigger={<DropdownMenuItem>Dispatch</DropdownMenuItem>} />
                            <JobSiteControlsDialog jobId={job.id} trigger={<DropdownMenuItem>Job controls</DropdownMenuItem>} />
                          </RowActionsMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Mobile */}
        <div className="sm:hidden p-3 space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-xl border bg-background/50 py-10 text-center text-muted-foreground">
              No service calls match your filters.
            </div>
          ) : null}
          {filtered.map(({ job, tags }) => {
            const customer = data.customers.find((c) => c.id === (job.customer_id ?? "")) as any;
            const site = job.site_id ? data.sites.find((s) => s.id === job.site_id) : null;
            const tech = job.technician_id ? data.technicians.find((t) => t.id === job.technician_id) : null;
            const afterHours = hasTag(tags, "after-hours") || (job.scheduled_at ? isAfterHours(job.scheduled_at) : false);
            return (
              <Card key={job.id} className="bg-background/50">
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold leading-tight break-words">{job.title}</div>
                      <div className="text-xs text-muted-foreground whitespace-normal break-words">{job.description ?? "—"}</div>
                    </div>
                    <Badge variant={job.priority === "emergency" ? "destructive" : "secondary"} className="capitalize">
                      {String(job.priority ?? "normal")}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>
                      <span className="font-medium text-foreground">Customer:</span> {customer?.name ?? "—"}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Site:</span> {site?.name ?? "No site"}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Technician:</span> {tech?.name ?? "Unassigned"}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Dispatch:</span>{" "}
                      {job.scheduled_at ? format(new Date(job.scheduled_at), "PPp") : "Not scheduled"}
                      {afterHours ? <span className="ml-2">• After-hours</span> : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <JobStatusBadge status={job.status} />
                    <RowActionsMenu label="Service call actions">
                      <ServiceCallDispatchDialog job={job as any} trigger={<DropdownMenuItem>Dispatch</DropdownMenuItem>} />
                      <JobSiteControlsDialog jobId={job.id} trigger={<DropdownMenuItem>Job controls</DropdownMenuItem>} />
                    </RowActionsMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
