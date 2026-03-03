import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageHeader from "@/features/dashboard/components/page-header";
import { KpiCard, DensityProvider } from "@/features/dashboard/components/dashboard-kpi-utils";
import CreateMaintenancePlanDialog from "@/features/dashboard/components/dialogs/create-maintenance-plan-dialog";
import JobSiteControlsDialog from "@/features/dashboard/components/dialogs/job-site-controls-dialog";
import RowActionsMenu from "@/components/row-actions-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  computeNextDue,
  formatRepeat,
  getMaintenanceInterval,
  getMaintenanceRepeat,
  getMaintenanceScheduleId,
  isMaintenanceJob,
  type MaintenanceRepeat,
} from "@/features/dashboard/lib/maintenance";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, ClipboardList, RefreshCcw } from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";

export default function MaintenanceSchedules() {
  const { data, actions } = useDashboardData();

  const [scope, setScope] = React.useState<"active" | "all">("active");

  const plumbingJobs = React.useMemo(() => data.jobCards.filter((j) => j.trade_id === "plumbing"), [data.jobCards]);
  const maintenanceJobs = React.useMemo(
    () => plumbingJobs.filter((j) => isMaintenanceJob(j.notes) && getMaintenanceScheduleId(j.notes)),
    [plumbingJobs],
  );

  const grouped = React.useMemo(() => {
    const m = new Map<string, any[]>();
    for (const j of maintenanceJobs) {
      const msid = getMaintenanceScheduleId(j.notes);
      if (!msid) continue;
      const arr = m.get(msid) ?? [];
      arr.push(j);
      m.set(msid, arr);
    }
    return m;
  }, [maintenanceJobs]);

  const plans = React.useMemo(() => {
    const now = Date.now();
    const out: Array<{
      msid: string;
      repeat: MaintenanceRepeat | null;
      interval: number;
      title: string;
      customerId: string | null;
      siteId: string | null;
      jobs: any[];
      nextJob: any | null;
      lastCompleted: any | null;
      overdue: boolean;
    }> = [];

    for (const [msid, jobs] of grouped.entries()) {
      const sorted = jobs.slice().sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      const sample = sorted[0];
      const repeat = getMaintenanceRepeat(sample.notes);
      const interval = getMaintenanceInterval(sample.notes);

      const nextCandidates = jobs
        .filter((j) => j.status !== "cancelled" && j.status !== "invoiced" && j.status !== "completed")
        .slice()
        .sort((a, b) => {
          const aAt = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity;
          const bAt = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity;
          return aAt - bAt;
        });
      const nextJob = nextCandidates[0] ?? null;

      const lastCompleted = jobs
        .filter((j) => j.status === "completed" || j.status === "invoiced")
        .slice()
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0] ?? null;

      const overdue =
        !!nextJob?.scheduled_at &&
        (nextJob.status === "new" || nextJob.status === "scheduled") &&
        new Date(nextJob.scheduled_at).getTime() < now;

      const title = sample.title || "Maintenance";

      out.push({
        msid,
        repeat,
        interval,
        title,
        customerId: sample.customer_id ?? null,
        siteId: sample.site_id ?? null,
        jobs,
        nextJob,
        lastCompleted,
        overdue,
      });
    }

    out.sort((a, b) => {
      const aAt = a.nextJob?.scheduled_at ? new Date(a.nextJob.scheduled_at).getTime() : Infinity;
      const bAt = b.nextJob?.scheduled_at ? new Date(b.nextJob.scheduled_at).getTime() : Infinity;
      if (aAt !== bAt) return aAt - bAt;
      return a.title.localeCompare(b.title);
    });

    if (scope === "active") {
      return out.filter((p) => p.nextJob && p.nextJob.status !== "cancelled");
    }
    return out;
  }, [grouped, scope]);

  const stats = React.useMemo(() => {
    const now = Date.now();
    const inNext7Days = (iso?: string | null) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return Number.isFinite(t) && t >= now && t <= now + 7 * 86_400_000;
    };
    const overdue = plans.filter((p) => p.overdue).length;
    const due7 = plans.filter((p) => inNext7Days(p.nextJob?.scheduled_at ?? null)).length;
    const total = plans.length;
    const completedMonth = maintenanceJobs.filter((j) => (j.status === "completed" || j.status === "invoiced") && j.updated_at).filter((j) => {
      const d = new Date(j.updated_at);
      const n = new Date();
      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
    }).length;
    return { overdue, due7, total, completedMonth };
  }, [maintenanceJobs, plans]);

  const scheduleNext = async (plan: (typeof plans)[number], opts?: { excludeJobId?: string }) => {
    if (!plan.repeat) return;
    const now = Date.now();
    const hasFuture = plan.jobs.some((j: any) => {
      if (opts?.excludeJobId && j.id === opts.excludeJobId) return false;
      if (!j.scheduled_at) return false;
      if (j.status === "cancelled" || j.status === "completed" || j.status === "invoiced") return false;
      return new Date(j.scheduled_at).getTime() > now;
    });
    if (hasFuture) {
      toast({ title: "Next maintenance already scheduled", description: "This plan already has a future due job card." });
      return;
    }

    const baseIso = plan.nextJob?.scheduled_at ?? plan.lastCompleted?.scheduled_at ?? plan.lastCompleted?.updated_at ?? plan.jobs[0]?.scheduled_at ?? null;
    const base = baseIso ? new Date(baseIso) : new Date();
    const nextDue = computeNextDue({ from: base, repeat: plan.repeat, interval: plan.interval });

    const template = plan.nextJob ?? plan.lastCompleted ?? plan.jobs[0];
    const created = await actions.addJobCard({
      trade_id: "plumbing",
      title: template.title,
      description: template.description ?? null,
      status: "scheduled",
      priority: template.priority ?? "normal",
      customer_id: template.customer_id ?? null,
      site_id: template.site_id ?? null,
      technician_id: template.technician_id ?? null,
      scheduled_at: nextDue.toISOString(),
      revenue_cents: null,
      notes: template.notes ?? null,
      checklist: Array.isArray(template.checklist) ? template.checklist : [],
    } as any);
    if (!created) return;
    toast({ title: "Next maintenance scheduled", description: format(nextDue, "PPp") });
  };

  const completeAndScheduleNext = async (plan: (typeof plans)[number]) => {
    if (!plan.nextJob) return;
    if (!plan.repeat) return;
    await actions.setJobCardStatus(plan.nextJob.id, "completed");
    await scheduleNext({ ...plan, lastCompleted: plan.nextJob, nextJob: null } as any, { excludeJobId: plan.nextJob.id });
  };

  const subtitle = "Schedule and track recurring plumbing maintenance work. Each plan creates scheduled job cards you can dispatch and complete.";

  return (
    <div className="space-y-6">
      <div data-tour="maintenance-header">
        <PageHeader
          title="Maintenance"
          subtitle={subtitle}
          actions={(
            <>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void actions.refreshData()}>
                <RefreshCcw className="h-4 w-4" /> Refresh
              </Button>
              <CreateMaintenancePlanDialog onCreated={() => void actions.refreshData({ silent: true })} />
            </>
          )}
        />
      </div>

      <DensityProvider>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4" data-tour="maintenance-stats">
          <KpiCard icon={ClipboardList} label="Plans" value={stats.total} />
          <KpiCard icon={AlertTriangle} label="Overdue" value={stats.overdue} accent={stats.overdue > 0 ? "destructive" : undefined} />
          <KpiCard icon={CalendarClock} label="Due next 7 days" value={stats.due7} accent={stats.due7 > 0 ? "warning" : undefined} />
          <KpiCard icon={CheckCircle2} label="Completed (month)" value={stats.completedMonth} />
        </div>
      </DensityProvider>

      <Card className="bg-card/70 backdrop-blur-sm" data-tour="maintenance-view">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">View</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Select value={scope} onValueChange={(v) => setScope(v as any)}>
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active plans</SelectItem>
              <SelectItem value="all">All plans</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/dashboard/jobs">
              Open job cards <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="rounded-xl border bg-card/70 backdrop-blur-sm overflow-hidden" data-tour="maintenance-table">
        <div className="hidden sm:block overflow-x-auto">
          <div className="min-w-[1100px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead className="w-[180px]">Repeat</TableHead>
                  <TableHead className="w-[180px]">Next due</TableHead>
                  <TableHead className="w-[180px]">Last done</TableHead>
                  <TableHead className="w-[220px]">Customer</TableHead>
                  <TableHead className="w-[220px]">Site</TableHead>
                  <TableHead className="w-[220px]">Technician</TableHead>
                  <TableHead className="w-[340px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      No maintenance plans yet.
                    </TableCell>
                  </TableRow>
                ) : null}
                {plans.map((p) => {
                  const customer = p.customerId ? data.customers.find((c) => c.id === p.customerId) : null;
                  const site = p.siteId ? data.sites.find((s) => s.id === p.siteId) : null;
                  const tech = p.nextJob?.technician_id ? data.technicians.find((t) => t.id === p.nextJob.technician_id) : null;
                  return (
                    <TableRow key={p.msid} className="align-top">
                      <TableCell className="min-w-[320px]">
                        <div className="font-medium">{p.title}</div>
                        <div className="text-xs text-muted-foreground">MSID: {p.msid}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.repeat ? formatRepeat(p.repeat, p.interval) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.nextJob?.scheduled_at ? (
                          <div className="space-y-1">
                            <div className="font-medium">{format(new Date(p.nextJob.scheduled_at), "PPp")}</div>
                            {p.overdue ? <Badge variant="destructive">Overdue</Badge> : null}
                            {p.nextJob.status === "in-progress" ? <Badge variant="secondary">In progress</Badge> : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not scheduled</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.lastCompleted ? format(new Date(p.lastCompleted.updated_at), "PP") : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium truncate">{customer?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">{customer?.phone ?? "—"}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium truncate">{site?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">{site?.address ?? "—"}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium truncate">{tech?.name ?? "Unassigned"}</div>
                        <div className="text-xs text-muted-foreground truncate">{tech?.phone ?? "—"}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <RowActionsMenu label="Maintenance actions">
                            {p.nextJob ? (
                              <JobSiteControlsDialog jobId={p.nextJob.id} trigger={<DropdownMenuItem>Job controls</DropdownMenuItem>} />
                            ) : (
                              <DropdownMenuItem disabled>Job controls</DropdownMenuItem>
                            )}
                            <MaintenanceHistoryDialog msid={p.msid} jobs={p.jobs} trigger={<DropdownMenuItem>History</DropdownMenuItem>} />
                            <DropdownMenuItem disabled={!p.repeat} onSelect={() => void scheduleNext(p)}>
                              Schedule next
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={!p.nextJob || !p.repeat} onSelect={() => void completeAndScheduleNext(p)}>
                              Complete + next
                            </DropdownMenuItem>
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
          {plans.length === 0 ? (
            <div className="rounded-xl border bg-background/50 py-10 text-center text-muted-foreground">
              No maintenance plans yet.
            </div>
          ) : null}
          {plans.map((p) => {
            const customer = p.customerId ? data.customers.find((c) => c.id === p.customerId) : null;
            const site = p.siteId ? data.sites.find((s) => s.id === p.siteId) : null;
            return (
              <Card key={p.msid} className="bg-background/50">
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold leading-tight break-words">{p.title}</div>
                      <div className="text-xs text-muted-foreground">{p.repeat ? formatRepeat(p.repeat, p.interval) : "—"}</div>
                    </div>
                    {p.overdue ? <Badge variant="destructive">Overdue</Badge> : null}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div><span className="font-medium text-foreground">Customer:</span> {customer?.name ?? "—"}</div>
                    <div><span className="font-medium text-foreground">Site:</span> {site?.name ?? "—"}</div>
                    <div><span className="font-medium text-foreground">Next:</span> {p.nextJob?.scheduled_at ? format(new Date(p.nextJob.scheduled_at), "PPp") : "Not scheduled"}</div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex justify-end w-full">
                      <RowActionsMenu label="Maintenance actions">
                        {p.nextJob ? (
                          <JobSiteControlsDialog jobId={p.nextJob.id} trigger={<DropdownMenuItem>Job controls</DropdownMenuItem>} />
                        ) : (
                          <DropdownMenuItem disabled>Job controls</DropdownMenuItem>
                        )}
                        <MaintenanceHistoryDialog msid={p.msid} jobs={p.jobs} trigger={<DropdownMenuItem>History</DropdownMenuItem>} />
                        <DropdownMenuItem disabled={!p.repeat} onSelect={() => void scheduleNext(p)}>
                          Schedule next
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={!p.nextJob || !p.repeat} onSelect={() => void completeAndScheduleNext(p)}>
                          Complete + next
                        </DropdownMenuItem>
                      </RowActionsMenu>
                    </div>
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

function MaintenanceHistoryDialog({ msid, jobs, trigger }: { msid: string; jobs: any[]; trigger?: React.ReactNode }) {
  const rows = React.useMemo(() => {
    return jobs
      .slice()
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10);
  }, [jobs]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            History
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Maintenance history</DialogTitle>
          <DialogDescription>MSID: {msid}</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border bg-card/70 backdrop-blur-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Scheduled</TableHead>
                <TableHead className="w-[160px]">Updated</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {j.scheduled_at ? format(new Date(j.scheduled_at), "PPp") : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {j.updated_at ? format(new Date(j.updated_at), "PPp") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{String(j.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <JobSiteControlsDialog jobId={j.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
