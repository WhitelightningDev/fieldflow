import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import PageHeader from "@/features/dashboard/components/page-header";
import {
  computeBaseMetrics,
  computeTechMetrics,
  isLast30Days,
  isToday,
  KpiCard,
  SectionHeader,
} from "@/features/dashboard/components/dashboard-kpi-utils";
import { OpsSnapshot } from "@/features/dashboard/components/overview/ops-snapshot";
import { formatZarFromCents } from "@/lib/money";
import {
  AlertTriangle,
  CheckSquare,
  Clock,
  DollarSign,
  Package,
  Percent,
  PhoneForwarded,
  RotateCcw,
  ShieldCheck,
  Tag,
  TrendingUp,
  WashingMachine,
} from "lucide-react";
import { Link } from "react-router-dom";

type Props = { data: any; allJobs: any[] };

export default function ApplianceRepairDashboard({ data, allJobs }: Props) {
  const base = computeBaseMetrics(allJobs, data.technicians);
  const techMetrics = computeTechMetrics(allJobs, data.technicians);

  const jobsToday = allJobs.filter((j) => j.scheduled_at && isToday(j.scheduled_at));

  /* ── Appliance-specific metrics ── */
  const warrantyJobs = allJobs.filter((j: any) => {
    const hay = `${j.title ?? ""} ${j.description ?? ""} ${j.notes ?? ""}`.toLowerCase();
    return hay.includes("warranty");
  });
  const warrantyJobsMonth = warrantyJobs.filter((j: any) => isLast30Days(j.created_at));
  const warrantyRevenue = warrantyJobs.reduce((s: number, j: any) => s + (j.revenue_cents ?? 0), 0);

  const partsWaiting = allJobs.filter((j: any) => {
    const notes = String(j.notes ?? "").toLowerCase();
    return notes.includes("awaiting parts") || notes.includes("back order") || notes.includes("backorder");
  });

  const firstVisitFix = (() => {
    const completed = allJobs.filter((j: any) => j.status === "completed" || j.status === "invoiced");
    if (completed.length === 0) return 0;
    const callbacks = completed.filter((j: any) => {
      const notes = String(j.notes ?? "").toLowerCase();
      return notes.includes("callback") || notes.includes("return") || notes.includes("rework");
    }).length;
    return Math.round(((completed.length - callbacks) / completed.length) * 100);
  })();

  const followUpsDue = allJobs.filter((j: any) => {
    const notes = String(j.notes ?? "").toLowerCase();
    return notes.includes("follow up") || notes.includes("follow-up") || notes.includes("followup");
  });

  const applianceTypes = (() => {
    const keywords = ["washing machine", "dishwasher", "fridge", "oven", "stove", "dryer", "tumble", "microwave"];
    const counts: Record<string, number> = {};
    for (const j of base.monthJobs) {
      const hay = `${j.title ?? ""} ${j.description ?? ""}`.toLowerCase();
      for (const kw of keywords) {
        if (hay.includes(kw)) {
          counts[kw] = (counts[kw] ?? 0) + 1;
          break;
        }
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  })();

  const repeatCustomers = (() => {
    const custCounts: Record<string, number> = {};
    allJobs.filter((j: any) => j.customer_id && isLast30Days(j.created_at)).forEach((j: any) => {
      custCounts[j.customer_id] = (custCounts[j.customer_id] ?? 0) + 1;
    });
    return Object.values(custCounts).filter((c) => c >= 2).length;
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appliance Repair Dashboard"
        subtitle={`${data.company?.name} — Warranty, parts, and first-visit performance`}
        actions={(
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/repair-history">Repair history</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/warranty-tracker">Warranty tracker</Link>
            </Button>
          </>
        )}
      />

      {/* WARRANTY & PARTS */}
      <div>
        <SectionHeader title="Warranty & Parts" question="Are warranty claims and parts delays under control?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={ShieldCheck} label="Warranty Claims (30d)" value={warrantyJobsMonth.length} accent={warrantyJobsMonth.length > 5 ? "warning" : undefined} sub="often zero-margin work" />
          <KpiCard icon={Tag} label="Total Warranty Jobs" value={warrantyJobs.length} sub={formatZarFromCents(warrantyRevenue) + " revenue"} />
          <KpiCard icon={Package} label="Awaiting Parts" value={partsWaiting.length} accent={partsWaiting.length > 0 ? "warning" : undefined} sub="each day = lost revenue" />
          <KpiCard icon={CheckSquare} label="First-Visit Fix Rate" value={`${firstVisitFix}%`} accent={firstVisitFix < 70 ? "destructive" : undefined} sub="higher = fewer callbacks" />
          <KpiCard icon={PhoneForwarded} label="Follow-ups Due" value={followUpsDue.length} accent={followUpsDue.length > 0 ? "warning" : undefined} sub="customer retention" />
        </div>
      </div>

      <OpsSnapshot
        title="Operations Snapshot"
        inventoryItems={data.inventoryItems}
        technicians={data.technicians}
        jobs={allJobs}
        sites={data.sites}
        technicianLocations={data.technicianLocations}
        jobTimeEntries={data.jobTimeEntries}
        siteMaterialUsage={data.siteMaterialUsage}
      />

      {/* APPLIANCE TYPES & REVENUE */}
      <div>
        <SectionHeader title="Revenue & Appliance Mix" question="Which appliances are driving revenue?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={DollarSign} label="Avg Revenue / Repair" value={formatZarFromCents(base.avgRevenuePerJob)} />
          <KpiCard icon={TrendingUp} label="Revenue (Month)" value={formatZarFromCents(base.revenueThisMonth)} />
          <KpiCard icon={Percent} label="Gross Margin" value={`${base.grossMargin}%`} accent={base.grossMargin < 30 ? "destructive" : undefined}>
            <Progress value={Math.max(0, base.grossMargin)} className="mt-2 h-1.5" />
          </KpiCard>
          <KpiCard icon={RotateCcw} label="Repeat Customers (30d)" value={repeatCustomers} sub="returning for more repairs" />
          <KpiCard icon={WashingMachine} label="Top Appliance" value={applianceTypes.length > 0 ? applianceTypes[0][0] : "—"} sub={applianceTypes.length > 0 ? `${applianceTypes[0][1]} jobs this month` : "add appliance type to job titles"} />
        </div>
        {base.callbackJobs.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Callbacks eating margins</AlertTitle>
            <AlertDescription>
              {base.callbackJobs.length} callback{base.callbackJobs.length > 1 ? "s" : ""} in 30 days. Wrong diagnosis = double parts + labour cost. Check first-visit fix rate.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* TODAY */}
      <div>
        <SectionHeader title="Today" question="What's on the schedule?" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard icon={Clock} label="Repairs Scheduled Today" value={jobsToday.length} />
          <KpiCard icon={WashingMachine} label="In Progress" value={allJobs.filter((j) => j.status === "in-progress").length} />
          <KpiCard icon={Clock} label="Avg Turnaround" value={`${base.avgResponseHrs}h`} sub="quote to scheduled" />
        </div>
      </div>

      {/* TECHNICIAN METRICS */}
      <div>
        <SectionHeader title="Technician Performance" question="Who's fixing right the first time?" />
        <TechTable techMetrics={techMetrics} />
      </div>
    </div>
  );
}

function TechTable({ techMetrics }: { techMetrics: any[] }) {
  if (techMetrics.length === 0) {
    return <Card className="bg-card/70 backdrop-blur-sm"><CardContent className="py-8 text-center text-muted-foreground text-sm">No active technicians yet.</CardContent></Card>;
  }
  return (
    <Card className="bg-card/70 backdrop-blur-sm">
      <CardContent className="pt-6 space-y-4">
        {techMetrics.map((t) => (
          <div key={t.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.completed} completed · {t.returnVisits} returns</div>
              </div>
              <div className="flex items-center gap-4 text-sm shrink-0">
                <div className="text-center"><div className={`font-bold ${t.firstTimeFix < 80 ? "text-destructive" : ""}`}>{t.firstTimeFix}%</div><div className="text-[10px] text-muted-foreground">Fix rate</div></div>
                <div className="text-center"><div className="font-bold">{formatZarFromCents(t.revenue)}</div><div className="text-[10px] text-muted-foreground">Revenue</div></div>
              </div>
            </div>
            <Separator className="mt-3" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
