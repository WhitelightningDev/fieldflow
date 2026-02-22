import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/features/dashboard/components/page-header";
import {
  computeBaseMetrics,
  computeTechMetrics,
  isAfterHours,
  isLast24h,
  isLast30Days,
  isThisMonth,
  isToday,
  KpiCard,
  SectionHeader,
} from "@/features/dashboard/components/dashboard-kpi-utils";
import { OpsSnapshot } from "@/features/dashboard/components/overview/ops-snapshot";
import JobSiteControlsDialog from "@/features/dashboard/components/dialogs/job-site-controls-dialog";
import { extractTags, getNoteLineValue, hasTag } from "@/features/dashboard/lib/service-calls";
import { useInventoryAlerts } from "@/features/dashboard/hooks/use-inventory-alerts";
import { isMaintenanceJob } from "@/features/dashboard/lib/maintenance";
import { distanceMeters, formatDistance, getLatLngFromAny, isArrived } from "@/lib/geo";
import { formatZarFromCents } from "@/lib/money";
import {
  AlertTriangle,
  ArrowUpRight,
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
  Briefcase,
  TrendingUp,
  Users,
  ListChecks,
  ClipboardList,
  HandCoins,
  Star,
  Wrench,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import * as React from "react";

type Props = { data: any; allJobs: any[] };

function isLastNDays(dateStr: string, days: number) {
  return Date.now() - new Date(dateStr).getTime() < days * 86_400_000;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseCsat(notes: string | null | undefined) {
  if (!notes) return null;
  const raw = getNoteLineValue(notes, "CSAT");
  const m = raw.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 10) / 10;
  if (rounded < 0.5 || rounded > 5) return null;
  return rounded;
}

function getJobTiming(jobId: string, entries: any[]) {
  const rows = entries.filter((e) => String(e?.job_card_id ?? "") === jobId);
  if (rows.length === 0) return { startedAt: null as Date | null, endedAt: null as Date | null };
  let minStart: number | null = null;
  let maxEnd: number | null = null;
  for (const e of rows) {
    const s = e?.started_at ? new Date(e.started_at).getTime() : null;
    const endVal = e?.ended_at ?? e?.started_at ?? null;
    const en = endVal ? new Date(endVal).getTime() : null;
    if (s != null && Number.isFinite(s)) minStart = minStart == null ? s : Math.min(minStart, s);
    if (en != null && Number.isFinite(en)) maxEnd = maxEnd == null ? en : Math.max(maxEnd, en);
  }
  return {
    startedAt: minStart != null ? new Date(minStart) : null,
    endedAt: maxEnd != null ? new Date(maxEnd) : null,
  };
}

export default function PlumbingDashboard({ data, allJobs }: Props) {
  // Guard against cross-trade KPI contamination: only compute plumbing KPIs from plumbing jobs.
  const jobs = React.useMemo(() => allJobs.filter((j: any) => j.trade_id === "plumbing"), [allJobs]);
  const base = computeBaseMetrics(jobs, data.technicians);
  const techMetrics = computeTechMetrics(jobs, data.technicians);

  const company = data.company as any;
  const overheadPct = (() => {
    const v = company?.labour_overhead_percent;
    if (v == null) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? clamp(n, 0, 100) : 0;
  })();

  const techById = new Map<string, any>((data.technicians ?? []).map((t: any) => [t.id, t]));
  const siteById = new Map<string, any>((data.sites ?? []).map((s: any) => [s.id, s]));
  const customerById = new Map<string, any>((data.customers ?? []).map((c: any) => [c.id, c]));
  const locByTechId = React.useMemo(() => {
    const m = new Map<string, any>();
    for (const l of (data.technicianLocations as any[]) ?? []) {
      const tid = l?.technician_id;
      if (!tid) continue;
      m.set(String(tid), l);
    }
    return m;
  }, [data.technicianLocations]);

  const timeEntries = (data.jobTimeEntries as any[]) ?? [];
  const materials = (data.siteMaterialUsage as any[]) ?? [];
  const plumbingInventory = React.useMemo(
    () => (data.inventoryItems ?? []).filter((i: any) => i.trade_id === "plumbing"),
    [data.inventoryItems],
  );
  const { lowStock, expiringSoon } = useInventoryAlerts(plumbingInventory as any);

  const timingByJobId = React.useMemo(() => {
    const m = new Map<string, { startedAt: Date | null; endedAt: Date | null }>();
    for (const j of jobs) {
      m.set(j.id, getJobTiming(j.id, timeEntries));
    }
    return m;
  }, [jobs, timeEntries]);

  const materialsByJobId = React.useMemo(() => {
    const m = new Map<string, any[]>();
    for (const u of materials) {
      const jobId = u.job_card_id;
      if (!jobId) continue;
      const arr = m.get(jobId) ?? [];
      arr.push(u);
      m.set(jobId, arr);
    }
    return m;
  }, [materials]);

  const openGasCoc = jobs.filter((j) => {
    const tags = extractTags(j.notes);
    return hasTag(tags, "gas-coc") && j.status !== "invoiced" && j.status !== "cancelled";
  }).length;
  const openPirbCoc = jobs.filter((j) => {
    const tags = extractTags(j.notes);
    return hasTag(tags, "pirb-coc") && j.status !== "invoiced" && j.status !== "cancelled";
  }).length;
  const openPressureTests = jobs.filter((j) => {
    const tags = extractTags(j.notes);
    return hasTag(tags, "pressure-test") && j.status !== "invoiced" && j.status !== "cancelled";
  }).length;

  const jobsToday = jobs.filter((j) => j.scheduled_at && isToday(j.scheduled_at));
  const scheduledToday = jobsToday.length;
  const inProgressNow = jobs.filter((j) => j.status === "in-progress").length;
  const completedToday = jobs.filter((j) => (j.status === "completed" || j.status === "invoiced") && j.updated_at && isToday(j.updated_at)).length;
  const emergencyToday = jobsToday.filter((j) => j.priority === "urgent" || j.priority === "emergency");
  const leakCallouts24h = jobs.filter(
    (j) => j.created_at && isLast24h(j.created_at) &&
      (j.title?.toLowerCase().includes("leak") || j.description?.toLowerCase().includes("leak")),
  );
  const awaitingParts = jobs.filter((j) => j.notes?.toLowerCase().includes("awaiting parts"));
  const waterHeaterJobs = base.monthJobs.filter(
    (j) => j.title?.toLowerCase().includes("water heater") || j.title?.toLowerCase().includes("geyser"),
  );
  const afterHoursRevenue = base.monthJobs
    .filter((j) => j.scheduled_at && isAfterHours(j.scheduled_at))
    .reduce((s: number, j: any) => s + (j.revenue_cents ?? 0), 0);

  const backlogUnassigned = jobs.filter(
    (j) => (j.status === "new" || j.status === "scheduled") && !j.technician_id,
  ).length;

  const completionRate30d = React.useMemo(() => {
    const scheduled = jobs.filter((j) => j.scheduled_at && isLast30Days(j.scheduled_at));
    if (scheduled.length === 0) return { onTimePct: 0, onTime: 0, total: 0 };
    const onTime = scheduled.filter((j) => {
      if (!(j.status === "completed" || j.status === "invoiced")) return false;
      const t = timingByJobId.get(j.id);
      const completedAt = (t?.endedAt ?? null) ? t!.endedAt! : new Date(j.updated_at);
      const scheduledAt = new Date(j.scheduled_at);
      return completedAt.getTime() <= scheduledAt.getTime() + 24 * 60 * 60 * 1000;
    }).length;
    return { onTimePct: Math.round((onTime / scheduled.length) * 100), onTime, total: scheduled.length };
  }, [jobs, timingByJobId]);

  const revenuePerTech = React.useMemo(() => {
    const active = (data.technicians ?? []).filter((t: any) => t.active);
    if (active.length === 0) return null;
    return Math.round(base.revenueThisMonth / active.length);
  }, [base.revenueThisMonth, data.technicians]);

  const breakEvenRevenue = React.useMemo(() => {
    const cost = base.totalLabourCost ?? 0;
    return Math.round(cost * (1 + overheadPct / 100));
  }, [base.totalLabourCost, overheadPct]);

  const billingAging = React.useMemo(() => {
    const unbilled = jobs.filter((j) => j.status === "completed");
    const buckets = { d0_7: 0, d8_30: 0, d31p: 0, total: unbilled.length };
    const now = Date.now();
    for (const j of unbilled) {
      const t = timingByJobId.get(j.id);
      const completedAt = t?.endedAt ?? new Date(j.updated_at);
      const days = Math.floor((now - completedAt.getTime()) / 86_400_000);
      if (days <= 7) buckets.d0_7 += 1;
      else if (days <= 30) buckets.d8_30 += 1;
      else buckets.d31p += 1;
    }
    return buckets;
  }, [jobs, timingByJobId]);

  const customerHealth = React.useMemo(() => {
    const periodJobs = jobs.filter((j) => j.created_at && isLastNDays(j.created_at, 90) && j.customer_id);
    const counts = new Map<string, number>();
    for (const j of periodJobs) {
      const cid = String(j.customer_id);
      counts.set(cid, (counts.get(cid) ?? 0) + 1);
    }
    const totalCustomers = counts.size;
    const repeatCustomers = Array.from(counts.values()).filter((n) => n >= 2).length;
    const repeatRatio = totalCustomers === 0 ? 0 : Math.round((repeatCustomers / totalCustomers) * 100);

    const csatRatings: number[] = [];
    for (const j of jobs) {
      if (!(j.status === "completed" || j.status === "invoiced")) continue;
      if (!j.updated_at || !isLastNDays(j.updated_at, 90)) continue;
      const n = parseCsat(j.notes);
      if (n != null) csatRatings.push(n);
    }
    const csatAvg = csatRatings.length ? Math.round((csatRatings.reduce((a, b) => a + b, 0) / csatRatings.length) * 10) / 10 : null;
    const csatCoverage = csatRatings.length;

    const top = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([customerId, jobs]) => ({ customerId, jobs, name: customerById.get(customerId)?.name ?? "Unknown" }));

    return { repeatRatio, totalCustomers, repeatCustomers, csatAvg, csatCoverage, top };
  }, [jobs, customerById]);

  const dispatchRows = React.useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startMs = startOfToday.getTime();
    const endMs = startMs + 7 * 86_400_000;
    const upcoming = jobs
      .filter((j) => {
        if (!j.scheduled_at) return false;
        const ms = new Date(j.scheduled_at).getTime();
        return Number.isFinite(ms) && ms >= startMs && ms <= Math.max(endMs, now);
      })
      .slice()
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    const today = upcoming.filter((j) => isToday(j.scheduled_at));
    return { today, next7: upcoming };
  }, [jobs]);

  const liveTechRows = React.useMemo(() => {
    const now = Date.now();
    const activeTechs = (data.technicians ?? []).filter((t: any) => t.active);
    const jobsByTech = new Map<string, any[]>();
    for (const j of jobs) {
      if (!j.technician_id) continue;
      const tid = String(j.technician_id);
      const arr = jobsByTech.get(tid) ?? [];
      arr.push(j);
      jobsByTech.set(tid, arr);
    }

    return activeTechs
      .map((t: any) => {
        const loc = locByTechId.get(t.id) ?? null;
        const techJobs = (jobsByTech.get(t.id) ?? []).slice();
        techJobs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        const inProgress = techJobs.find((j) => j.status === "in-progress") ?? null;
        const nextScheduled = techJobs
          .filter((j) => {
            if (!j.scheduled_at) return false;
            if (!(j.status === "scheduled" || j.status === "new")) return false;
            const ms = new Date(j.scheduled_at).getTime();
            return Number.isFinite(ms) && ms >= now - 2 * 60 * 60 * 1000;
          })
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] ?? null;
        const lastCompletedToday = techJobs.find((j) => (j.status === "completed" || j.status === "invoiced") && j.updated_at && isToday(j.updated_at)) ?? null;

        const currentJob = inProgress ?? nextScheduled ?? lastCompletedToday ?? null;
        const site = currentJob?.site_id ? siteById.get(currentJob.site_id) : null;

        const distM = (() => {
          if (!loc) return null;
          const techCoords = getLatLngFromAny(loc);
          const siteCoords = getLatLngFromAny(site);
          if (!techCoords || !siteCoords) return null;
          return distanceMeters(techCoords, siteCoords);
        })();

        const arrived = distM != null ? isArrived({ distanceM: distM, accuracyM: (loc as any)?.accuracy }) : false;
        const locTs = (loc?.updated_at ?? (loc as any)?.recorded_at) as string | null | undefined;
        const locAgeMin = locTs ? Math.round((now - new Date(locTs).getTime()) / 60000) : null;

        const status = (() => {
          if (inProgress) return arrived ? "On-site" : "En route";
          if (nextScheduled?.scheduled_at) {
            const mins = Math.round((new Date(nextScheduled.scheduled_at).getTime() - now) / 60000);
            if (mins <= 90) return "En route";
          }
          if (lastCompletedToday) return "Completed";
          return "Idle";
        })();

        return {
          tech: t,
          status,
          currentJob,
          site,
          arrived,
          distM,
          locAgeMin,
        };
      })
      .sort((a, b) => {
        const rank = (s: string) => (s === "On-site" ? 0 : s === "En route" ? 1 : s === "Completed" ? 2 : 3);
        const r = rank(a.status) - rank(b.status);
        if (r !== 0) return r;
        return String(a.tech.name ?? "").localeCompare(String(b.tech.name ?? ""));
      });
  }, [jobs, data.technicians, locByTechId, siteById]);

  const maintenanceStats = React.useMemo(() => {
    const now = Date.now();
    const ms = jobs.filter((j) => isMaintenanceJob(j.notes));
    const overdue = ms.filter((j) => (j.status === "new" || j.status === "scheduled") && j.scheduled_at && new Date(j.scheduled_at).getTime() < now).length;
    const due7 = ms.filter((j) => {
      if (!(j.status === "new" || j.status === "scheduled")) return false;
      if (!j.scheduled_at) return false;
      const t = new Date(j.scheduled_at).getTime();
      return Number.isFinite(t) && t >= now && t <= now + 7 * 86_400_000;
    }).length;
    return { overdue, due7, totalOpen: ms.filter((j) => j.status === "new" || j.status === "scheduled" || j.status === "in-progress").length };
  }, [jobs]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plumbing Overview"
        subtitle={`${data.company?.name} — Scheduling, cashflow, compliance, and performance`}
        actions={(
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/dashboard/service-calls">Service calls</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/dashboard/jobs">Job cards</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/dashboard/technicians">Technicians</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/dashboard/inventory">Inventory</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/dashboard/customers">Customers</Link>
            </Button>
          </>
        )}
      />

      {/* ─── BUSINESS HEALTH KPIS ─── */}
      <div>
        <SectionHeader title="Business Health" question="Are ops, cashflow, and customers healthy?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            icon={ListChecks}
            label="Completion Rate (30d)"
            value={`${completionRate30d.onTimePct}%`}
            sub={completionRate30d.total ? `${completionRate30d.onTime}/${completionRate30d.total} on time` : "No scheduled jobs"}
            accent={completionRate30d.onTimePct < 70 && completionRate30d.total > 0 ? "destructive" : undefined}
          />
          <KpiCard
            icon={ClipboardList}
            label="Work Order Backlog"
            value={backlogUnassigned}
            sub="open + unassigned"
            accent={backlogUnassigned > 0 ? "warning" : undefined}
          />
          <KpiCard
            icon={DollarSign}
            label="Revenue / Tech (Month)"
            value={revenuePerTech == null ? "—" : formatZarFromCents(revenuePerTech)}
            sub="active technicians"
          />
          <KpiCard
            icon={HandCoins}
            label="Break-even (Month)"
            value={formatZarFromCents(breakEvenRevenue)}
            sub={`Overhead ${overheadPct}%`}
            accent={base.revenueThisMonth < breakEvenRevenue ? "destructive" : undefined}
          />
          <KpiCard
            icon={FileWarning}
            label="Billing Backlog"
            value={billingAging.total}
            sub={billingAging.total ? `0–7d ${billingAging.d0_7} • 8–30d ${billingAging.d8_30} • 31+d ${billingAging.d31p}` : "No completed jobs pending invoice"}
            accent={billingAging.d31p > 0 ? "destructive" : billingAging.d8_30 > 0 ? "warning" : undefined}
          />
          <KpiCard
            icon={Users}
            label="Repeat Customers (90d)"
            value={`${customerHealth.repeatRatio}%`}
            sub={customerHealth.totalCustomers ? `${customerHealth.repeatCustomers}/${customerHealth.totalCustomers} repeat` : "No customers in period"}
          />
          <KpiCard
            icon={Star}
            label="CSAT (90d)"
            value={customerHealth.csatAvg == null ? "—" : `${customerHealth.csatAvg}/5`}
            sub={customerHealth.csatCoverage ? `${customerHealth.csatCoverage} rated job${customerHealth.csatCoverage === 1 ? "" : "s"}` : "Add “CSAT: 1-5” to job notes"}
            accent={customerHealth.csatAvg != null && customerHealth.csatAvg < 3.5 ? "destructive" : undefined}
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between gap-3">
                <span>Customer health</span>
                <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                  <Link to="/dashboard/customers">
                    Open customers <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-background/50 p-3">
                  <div className="text-xs text-muted-foreground">Repeat ratio</div>
                  <div className="text-xl font-bold">{customerHealth.repeatRatio}%</div>
                  <div className="text-[11px] text-muted-foreground">{customerHealth.repeatCustomers}/{customerHealth.totalCustomers} customers</div>
                </div>
                <div className="rounded-lg border bg-background/50 p-3">
                  <div className="text-xs text-muted-foreground">CSAT average</div>
                  <div className="text-xl font-bold">{customerHealth.csatAvg == null ? "—" : `${customerHealth.csatAvg}/5`}</div>
                  <div className="text-[11px] text-muted-foreground">{customerHealth.csatCoverage ? `${customerHealth.csatCoverage} rated jobs` : "No CSAT captured"}</div>
                </div>
                <div className="rounded-lg border bg-background/50 p-3">
                  <div className="text-xs text-muted-foreground">Call-out settings</div>
                  <div className="text-[11px] text-muted-foreground">
                    {company?.callout_fee_cents ? `Fee R${(Number(company.callout_fee_cents) / 100).toFixed(0)}` : "Fee not set"}
                    {company?.callout_radius_km ? ` • Radius ${company.callout_radius_km}km` : ""}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Top customers (90d)</div>
                {customerHealth.top.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No customers in period.</div>
                ) : (
                  <div className="space-y-1.5">
                    {customerHealth.top.map((c) => (
                      <div key={c.customerId} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{c.name}</div>
                        </div>
                        <Badge variant="secondary">{c.jobs} job{c.jobs === 1 ? "" : "s"}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Billing aging (uninvoiced)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-background/50 p-3">
                  <div className="text-xs text-muted-foreground">0–7 days</div>
                  <div className="text-xl font-bold">{billingAging.d0_7}</div>
                </div>
                <div className="rounded-lg border bg-background/50 p-3">
                  <div className="text-xs text-muted-foreground">8–30 days</div>
                  <div className="text-xl font-bold">{billingAging.d8_30}</div>
                </div>
                <div className="rounded-lg border bg-background/50 p-3">
                  <div className="text-xs text-muted-foreground">31+ days</div>
                  <div className={`text-xl font-bold ${billingAging.d31p ? "text-destructive" : ""}`}>{billingAging.d31p}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Tip: “Billing Backlog” tracks jobs in <span className="font-medium text-foreground">Completed</span> status (work done, invoice not yet raised).
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          <Card className="bg-card/70 backdrop-blur-sm lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between gap-3">
                <span>Dispatch timeline</span>
                <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                  <Link to="/dashboard/service-calls">
                    Open service calls <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="today" className="w-full">
                <TabsList className="w-full justify-start overflow-x-auto">
                  <TabsTrigger value="today">Today <span className="ml-2 text-muted-foreground">({dispatchRows.today.length})</span></TabsTrigger>
                  <TabsTrigger value="next7">Next 7 days <span className="ml-2 text-muted-foreground">({dispatchRows.next7.length})</span></TabsTrigger>
                </TabsList>
                <TabsContent value="today" className="mt-3">
                  <DispatchTable rows={dispatchRows.today} techById={techById} siteById={siteById} customerById={customerById} timingByJobId={timingByJobId} />
                </TabsContent>
                <TabsContent value="next7" className="mt-3">
                  <DispatchTable rows={dispatchRows.next7} techById={techById} siteById={siteById} customerById={customerById} timingByJobId={timingByJobId} />
                </TabsContent>
              </Tabs>
              <div className="mt-3 text-[11px] text-muted-foreground">
                Delays are flagged when scheduled time has passed and the job hasn’t started.
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Live technician status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {liveTechRows.length === 0 ? (
                <div className="text-sm text-muted-foreground">No active technicians yet.</div>
              ) : (
                <div className="space-y-2">
                  {liveTechRows.map((r) => (
                    <div key={r.tech.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{r.tech.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {r.currentJob ? r.currentJob.title : "No assigned work"}
                          {r.site?.name ? ` • ${r.site.name}` : ""}
                        </div>
                        {r.distM != null ? (
                          <div className="text-[11px] text-muted-foreground">
                            {r.arrived ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">Arrived</span> : <span>{formatDistance(r.distM)} away</span>}
                            {r.locAgeMin != null ? ` • GPS ${r.locAgeMin}m ago` : ""}
                          </div>
                        ) : r.locAgeMin != null ? (
                          <div className="text-[11px] text-muted-foreground">GPS {r.locAgeMin}m ago</div>
                        ) : (
                          <div className="text-[11px] text-muted-foreground">No live GPS</div>
                        )}
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <Badge
                          variant={r.status === "On-site" ? "default" : r.status === "En route" ? "secondary" : "outline"}
                          className={r.status === "Idle" ? "text-muted-foreground" : ""}
                        >
                          {r.status}
                        </Badge>
                        {r.currentJob ? <JobSiteControlsDialog jobId={r.currentJob.id} /> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── ACT TODAY ─── */}
      <div>
        <SectionHeader title="Operational Snapshot" question="How is work flowing today?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard icon={Flame} label="Emergency Jobs Today" value={emergencyToday.length} accent={emergencyToday.length > 0 ? "destructive" : undefined} />
          <KpiCard icon={ClipboardList} label="Scheduled Today" value={scheduledToday} />
          <KpiCard icon={TrendingUp} label="In Progress" value={inProgressNow} />
          <KpiCard icon={ListChecks} label="Completed Today" value={completedToday} />
          <KpiCard icon={Droplets} label="Leak Callouts (24h)" value={leakCallouts24h.length} accent={leakCallouts24h.length > 0 ? "warning" : undefined} />
          <KpiCard icon={Clock} label="Avg Response Time" value={`${base.avgResponseHrs}h`} />
          <KpiCard icon={PackageSearch} label="Awaiting Parts" value={awaitingParts.length} accent={awaitingParts.length > 0 ? "warning" : undefined} />
          <KpiCard icon={FileWarning} label="Unbilled Jobs" value={base.unbilledJobs.length} accent={base.unbilledJobs.length > 0 ? "destructive" : undefined} sub={base.unbilledJobs.length > 0 ? formatZarFromCents(base.unbilledRevenue) + " at risk" : undefined} />
          <KpiCard icon={CalendarClock} label="Maintenance Overdue" value={maintenanceStats.overdue} accent={maintenanceStats.overdue > 0 ? "destructive" : undefined} />
          <KpiCard icon={CalendarClock} label="Maintenance Due (7d)" value={maintenanceStats.due7} accent={maintenanceStats.due7 > 0 ? "warning" : undefined} />
        </div>
      </div>

      <OpsSnapshot
        title="Operations Snapshot"
        inventoryItems={data.inventoryItems}
        technicians={data.technicians}
        jobs={jobs}
        sites={data.sites}
        technicianLocations={data.technicianLocations}
        jobTimeEntries={data.jobTimeEntries}
        siteMaterialUsage={data.siteMaterialUsage}
      />

      {/* ─── WORK HISTORY + INVENTORY ─── */}
      <div>
        <SectionHeader title="Records" question="Do we have service records and part usage captured?" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between gap-3">
                <span>Work history & service records</span>
                <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                  <Link to="/dashboard/jobs">
                    Open jobs <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorkHistoryTable
                jobs={jobs}
                customerById={customerById}
                siteById={siteById}
                timingByJobId={timingByJobId}
                materialsByJobId={materialsByJobId}
              />
              <div className="mt-3 text-[11px] text-muted-foreground">
                Use “Site controls” to store photos, time logs, and materials per job/site.
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Inventory & tools usage (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <InventoryUsageTable jobs={jobs} materials={materials} inventoryItems={data.inventoryItems ?? []} />
              <div className="mt-3 text-[11px] text-muted-foreground">
                Costs are estimated from item unit costs. Wastage is included when logged.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── LOSING MONEY ─── */}
      <div>
        <SectionHeader title="Financial" question="Where am I losing money?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={DollarSign} label="Avg Revenue / Job" value={formatZarFromCents(base.avgRevenuePerJob)} />
          <KpiCard icon={Wrench} label="Water Heater Installs" value={waterHeaterJobs.length} sub="this month" />
          <KpiCard icon={TrendingUp} label="Revenue (Month)" value={formatZarFromCents(base.revenueThisMonth)} />
          <KpiCard icon={Percent} label="Gross Margin" value={`${base.grossMargin}%`} accent={base.grossMargin < 30 ? "destructive" : undefined}>
            <Progress value={Math.max(0, base.grossMargin)} className="mt-2 h-1.5" />
          </KpiCard>
          <KpiCard icon={PhoneCall} label="After-Hours Revenue" value={formatZarFromCents(afterHoursRevenue)} />
        </div>
        {base.callbackJobs.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Rework is eroding profit</AlertTitle>
            <AlertDescription>
              {base.callbackJobs.length} callback/rework job{base.callbackJobs.length > 1 ? "s" : ""} in 30 days. Each callback costs you the tech's time + fuel with zero new revenue.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* ─── RISK ─── */}
      <div>
        <SectionHeader title="Compliance & Safety" question="What could cause rework, penalties, or safety incidents?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard icon={RefreshCcw} label="Callbacks (30d)" value={base.callbackJobs.length} accent={base.callbackJobs.length > 0 ? "destructive" : undefined} sub="rework kills margin" />
          <KpiCard icon={ShieldCheck} label="Gas Compliance CoCs" value={openGasCoc} accent={openGasCoc > 0 ? "warning" : undefined} sub="open (tagged on service calls)" />
          <KpiCard icon={Briefcase} label="Pressure Tests" value={openPressureTests} accent={openPressureTests > 0 ? "warning" : undefined} sub="open (tagged on service calls)" />
          <KpiCard icon={ShieldCheck} label="PIRB CoCs" value={openPirbCoc} accent={openPirbCoc > 0 ? "warning" : undefined} sub="open (tagged on service calls)" />
          <KpiCard icon={PackageSearch} label="Low Stock" value={lowStock.length} accent={lowStock.length > 0 ? "warning" : undefined} sub="at/below reorder" />
          <KpiCard icon={AlertTriangle} label="Expiring Soon" value={expiringSoon.length} accent={expiringSoon.length > 0 ? "warning" : undefined} sub="perishables (14d)" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/service-calls?q=gas-coc&scope=service-calls">Gas CoCs</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/service-calls?q=pressure-test&scope=service-calls">Pressure tests</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/service-calls?q=pirb-coc&scope=service-calls">PIRB CoCs</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/maintenance-schedules">Maintenance plans</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/inventory">Inventory alerts</Link>
          </Button>
        </div>
      </div>

      {/* ─── ENTRY POINTS ─── */}
      <div>
        <SectionHeader title="Reports & Analytics" question="Jump into deeper insights and full records." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <LinkCard to="/dashboard/service-calls" title="Service calls" subtitle="Dispatch, emergencies, after-hours, and compliance tags." />
          <LinkCard to="/dashboard/maintenance-schedules" title="Maintenance" subtitle="Recurring schedules, due dates, and maintenance history." />
          <LinkCard to="/dashboard/jobs" title="Job cards" subtitle="Full work history with profitability, photos, materials, and time." />
          <LinkCard to="/dashboard/technicians" title="Technicians" subtitle="Rates, performance, and assignments." />
          <LinkCard to="/dashboard/inventory" title="Inventory" subtitle="Stock levels, costs, wastage, and reorder points." />
          <LinkCard to="/dashboard/customers" title="Customers" subtitle="Repeat customers, billing references, and contact details." />
          <LinkCard to="/dashboard/sites" title="Sites" subtitle="Addresses, GPS, scope of work, and site-level docs." />
        </div>
      </div>

      {/* ─── TECH METRICS ─── */}
      <div>
        <SectionHeader title="Technician Metrics" question="Who's making money and who's costing you?" />
        <TechMetricsTable techMetrics={techMetrics} />
      </div>
    </div>
  );
}

function LinkCard({ to, title, subtitle }: { to: string; title: string; subtitle: string }) {
  return (
    <Link to={to} className="block">
      <Card className="bg-card/70 backdrop-blur-sm hover:bg-card/90 transition-colors">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between gap-3">
            <span>{title}</span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function DispatchTable({
  rows,
  techById,
  siteById,
  customerById,
  timingByJobId,
}: {
  rows: any[];
  techById: Map<string, any>;
  siteById: Map<string, any>;
  customerById: Map<string, any>;
  timingByJobId: Map<string, { startedAt: Date | null; endedAt: Date | null }>;
}) {
  const now = Date.now();
  if (rows.length === 0) {
    return <div className="rounded-xl border bg-background/50 py-8 text-center text-sm text-muted-foreground">No scheduled jobs in this range.</div>;
  }
  return (
    <div className="rounded-xl border bg-background/50 overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[980px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Scheduled</TableHead>
                <TableHead className="w-[160px]">Start / End</TableHead>
                <TableHead className="w-[220px]">Technician</TableHead>
                <TableHead className="w-[240px]">Customer</TableHead>
                <TableHead className="w-[280px]">Site</TableHead>
                <TableHead>Job</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[160px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((j) => {
                const scheduledAt = j.scheduled_at ? new Date(j.scheduled_at) : null;
                const timing = timingByJobId.get(j.id) ?? { startedAt: null, endedAt: null };
                const started = timing.startedAt;
                const ended = timing.endedAt;
                const tech = j.technician_id ? techById.get(j.technician_id) : null;
                const site = j.site_id ? siteById.get(j.site_id) : null;
                const cust = j.customer_id ? customerById.get(j.customer_id) : null;
                const delayedMin = scheduledAt && (j.status === "new" || j.status === "scheduled") && now > scheduledAt.getTime()
                  ? Math.round((now - scheduledAt.getTime()) / 60000)
                  : null;
                return (
                  <TableRow key={j.id} className="align-top">
                    <TableCell className="text-xs text-muted-foreground">
                      {scheduledAt ? (
                        <div className="space-y-0.5">
                          <div className="font-medium text-foreground">{format(scheduledAt, "EEE, MMM d")}</div>
                          <div className="flex items-center gap-2">
                            <span>{format(scheduledAt, "p")}</span>
                            {delayedMin != null && delayedMin >= 10 ? (
                              <Badge variant={delayedMin >= 60 ? "destructive" : "secondary"}>
                                Delayed {delayedMin}m
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <span>—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="space-y-0.5">
                        <div><span className="text-muted-foreground">Start:</span> {started ? format(started, "p") : "—"}</div>
                        <div><span className="text-muted-foreground">End:</span> {ended ? format(ended, "p") : "—"}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{tech?.name ?? "Unassigned"}</div>
                      {tech?.phone ? <div className="text-xs text-muted-foreground">{tech.phone}</div> : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium truncate">{cust?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">{cust?.phone ?? cust?.billing_phone ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium truncate">{site?.name ?? "No site"}</div>
                      <div className="text-xs text-muted-foreground truncate">{site?.address ?? "Use address in notes"}</div>
                    </TableCell>
                    <TableCell className="min-w-[260px]">
                      <div className="font-medium">{j.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{j.description ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant={j.priority === "emergency" ? "destructive" : "secondary"} className="capitalize">
                          {String(j.priority ?? "normal")}
                        </Badge>
                        <div className="text-xs"><span className="text-muted-foreground">Status:</span> {String(j.status)}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <JobSiteControlsDialog jobId={j.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function WorkHistoryTable({
  jobs,
  customerById,
  siteById,
  timingByJobId,
  materialsByJobId,
}: {
  jobs: any[];
  customerById: Map<string, any>;
  siteById: Map<string, any>;
  timingByJobId: Map<string, { startedAt: Date | null; endedAt: Date | null }>;
  materialsByJobId: Map<string, any[]>;
}) {
  const rows = React.useMemo(() => {
    return jobs
      .filter((j) => j.status === "completed" || j.status === "invoiced" || j.status === "cancelled")
      .slice()
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 12);
  }, [jobs]);

  if (rows.length === 0) {
    return <div className="rounded-xl border bg-background/50 py-8 text-center text-sm text-muted-foreground">No completed jobs yet.</div>;
  }

  return (
    <div className="rounded-xl border bg-background/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Completed</TableHead>
            <TableHead className="w-[220px]">Customer</TableHead>
            <TableHead className="w-[260px]">Site</TableHead>
            <TableHead>Job</TableHead>
            <TableHead className="w-[180px]">Records</TableHead>
            <TableHead className="w-[140px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((j) => {
            const cust = j.customer_id ? customerById.get(j.customer_id) : null;
            const site = j.site_id ? siteById.get(j.site_id) : null;
            const timing = timingByJobId.get(j.id) ?? { startedAt: null, endedAt: null };
            const mats = materialsByJobId.get(j.id) ?? [];
            const tags = extractTags(j.notes);
            const csat = parseCsat(j.notes);
            const hasNotes = Boolean((j.notes ?? "").trim());
            return (
              <TableRow key={j.id} className="align-top">
                <TableCell className="text-xs text-muted-foreground">
                  <div className="space-y-0.5">
                    <div className="font-medium text-foreground">{format(new Date(j.updated_at), "EEE, MMM d")}</div>
                    <div>{format(new Date(j.updated_at), "p")}</div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <div className="font-medium truncate">{cust?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground truncate">{cust?.phone ?? "—"}</div>
                </TableCell>
                <TableCell className="text-sm">
                  <div className="font-medium truncate">{site?.name ?? "No site"}</div>
                  <div className="text-xs text-muted-foreground truncate">{site?.address ?? "—"}</div>
                </TableCell>
                <TableCell className="min-w-[260px]">
                  <div className="font-medium">{j.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">{j.description ?? "—"}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {hasTag(tags, "gas-coc") ? <Badge variant="secondary">Gas CoC</Badge> : null}
                    {hasTag(tags, "pressure-test") ? <Badge variant="secondary">Pressure test</Badge> : null}
                    {hasTag(tags, "pirb-coc") ? <Badge variant="secondary">PIRB CoC</Badge> : null}
                    {csat != null ? <Badge variant="outline">CSAT {csat}/5</Badge> : null}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <div className="space-y-0.5">
                    <div><span className="text-muted-foreground">Time:</span> {timing.startedAt ? "✓" : "—"} {timing.startedAt && timing.endedAt ? `(${format(timing.startedAt, "p")}–${format(timing.endedAt, "p")})` : ""}</div>
                    <div><span className="text-muted-foreground">Materials:</span> {mats.length ? `✓ (${mats.length})` : "—"}</div>
                    <div><span className="text-muted-foreground">Notes:</span> {hasNotes ? "✓" : "—"}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <JobSiteControlsDialog jobId={j.id} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function InventoryUsageTable({
  jobs,
  materials,
  inventoryItems,
}: {
  jobs: any[];
  materials: any[];
  inventoryItems: any[];
}) {
  const jobIdsLast30 = React.useMemo(() => {
    const s = new Set<string>();
    for (const j of jobs) {
      if (j.updated_at && isLast30Days(j.updated_at)) s.add(j.id);
    }
    return s;
  }, [jobs]);

  const invById = React.useMemo(() => new Map((inventoryItems ?? []).map((i: any) => [i.id, i])), [inventoryItems]);

  const top = React.useMemo(() => {
    const m = new Map<string, { used: number; wasted: number; cost: number }>();
    for (const u of materials) {
      const jobId = String(u?.job_card_id ?? "");
      if (!jobId || !jobIdsLast30.has(jobId)) continue;
      const itemId = String(u?.inventory_item_id ?? "");
      if (!itemId) continue;
      const used = Number(u?.quantity_used ?? 0);
      const wasted = Number(u?.quantity_wasted ?? 0);
      const inv = invById.get(itemId);
      const unitCost = Number(inv?.unit_cost_cents ?? 0);
      const row = m.get(itemId) ?? { used: 0, wasted: 0, cost: 0 };
      row.used += Number.isFinite(used) ? used : 0;
      row.wasted += Number.isFinite(wasted) ? wasted : 0;
      row.cost += (Number.isFinite(used) ? used : 0) * (Number.isFinite(unitCost) ? unitCost : 0);
      row.cost += (Number.isFinite(wasted) ? wasted : 0) * (Number.isFinite(unitCost) ? unitCost : 0);
      m.set(itemId, row);
    }
    return Array.from(m.entries())
      .map(([itemId, v]) => ({ itemId, ...v, name: invById.get(itemId)?.name ?? "Unknown", unit: invById.get(itemId)?.unit ?? "" }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);
  }, [invById, jobIdsLast30, materials]);

  if (top.length === 0) {
    return <div className="rounded-xl border bg-background/50 py-8 text-center text-sm text-muted-foreground">No materials logged in the last 30 days.</div>;
  }

  return (
    <div className="rounded-xl border bg-background/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="w-[100px]">Used</TableHead>
            <TableHead className="w-[110px]">Wasted</TableHead>
            <TableHead className="w-[150px]">Est. cost</TableHead>
            <TableHead className="w-[140px]">On hand</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {top.map((r) => {
            const inv = invById.get(r.itemId);
            const onHand = inv?.quantity_on_hand ?? null;
            const reorder = inv?.reorder_point ?? null;
            const below = typeof onHand === "number" && typeof reorder === "number" && onHand <= reorder;
            return (
              <TableRow key={r.itemId}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.used}{r.unit ? ` ${r.unit}` : ""}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.wasted}{r.unit ? ` ${r.unit}` : ""}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatZarFromCents(Math.round(r.cost))}</TableCell>
                <TableCell className="text-sm">
                  <span className={below ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}>
                    {typeof onHand === "number" ? onHand : "—"}
                  </span>
                  {below ? <Badge variant="secondary" className="ml-2">Reorder</Badge> : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function TechMetricsTable({ techMetrics }: { techMetrics: any[] }) {
  if (techMetrics.length === 0) {
    return (
      <Card className="bg-card/70 backdrop-blur-sm">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">No active technicians yet.</CardContent>
      </Card>
    );
  }
  return (
    <Card className="bg-card/70 backdrop-blur-sm">
      <CardContent className="pt-6 space-y-4">
        {techMetrics.map((tech) => (
          <div key={tech.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{tech.name}</div>
                <div className="text-xs text-muted-foreground">
                  {tech.completed} completed · {tech.returnVisits} returns
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm shrink-0">
                <div className="text-center">
                  <div className={`font-bold ${tech.firstTimeFix < 80 ? "text-destructive" : ""}`}>{tech.firstTimeFix}%</div>
                  <div className="text-[10px] text-muted-foreground">Fix rate</div>
                </div>
                <div className="text-center">
                  <div className="font-bold">{formatZarFromCents(tech.revenue)}</div>
                  <div className="text-[10px] text-muted-foreground">Revenue</div>
                </div>
              </div>
            </div>
            <Separator className="mt-3" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
