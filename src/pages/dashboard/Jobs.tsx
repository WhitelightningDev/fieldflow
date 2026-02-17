import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isTradeId, type TradeId, TRADES } from "@/features/company-signup/content/trades";
import CreateJobCardDialog from "@/features/dashboard/components/dialogs/create-job-card-dialog";
import JobSiteControlsDialog from "@/features/dashboard/components/dialogs/job-site-controls-dialog";
import JobStatusBadge from "@/features/dashboard/components/job-status-badge";
import ProfitabilityPill from "@/features/dashboard/components/profitability-pill";
import { computeJobProfitability } from "@/features/dashboard/lib/profitability";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardSelectors } from "@/features/dashboard/hooks/use-dashboard-selectors";
import { useTradeFilter } from "@/features/dashboard/hooks/use-trade-filter";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import type { Database } from "@/integrations/supabase/types";
import { distanceMeters, formatDistance, getLatLngFromAny, isArrived } from "@/lib/geo";
import { format } from "date-fns";
import * as React from "react";

type JobCardStatus = Database["public"]["Enums"]["job_card_status"];
const STATUSES: JobCardStatus[] = ["new", "scheduled", "in-progress", "completed", "invoiced", "cancelled"];

export default function Jobs() {
  const { data, actions } = useDashboardData();
  const allowedTradeIds: TradeId[] | null = data.company?.industry && isTradeId(data.company.industry) ? [data.company.industry] : null;
  const { trade } = useTradeFilter(allowedTradeIds);
  const selectors = useDashboardSelectors(data, trade);

  const defaultTradeId = trade === "all" ? TRADES[0].id : trade;

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job cards"
        subtitle="Create, assign, and track job cards across all service trades."
        actions={<CreateJobCardDialog defaultTradeId={defaultTradeId} allowedTradeIds={allowedTradeIds} />}
      />

      <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Trade</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Technician</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Gross margin</TableHead>
              <TableHead className="w-[220px]">Update</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {selectors.jobCards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                  No job cards yet for this trade filter.
                </TableCell>
              </TableRow>
            ) : null}
            {selectors.jobCards.map((job) => {
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
                <TableRow key={job.id}>
                  <TableCell>
                    <div className="font-medium">{job.title}</div>
                    <div className="text-xs text-muted-foreground">{job.description || "—"}</div>
                  </TableCell>
                  <TableCell>
                    <JobStatusBadge status={job.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {TRADES.find((t) => t.id === job.trade_id)?.shortName ?? job.trade_id}
                  </TableCell>
                  <TableCell>{customer?.name ?? "—"}</TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <div className="truncate">{site?.name ?? <span className="text-muted-foreground">—</span>}</div>
                      {site && job.technician_id ? (
                        <div className="text-[11px] text-muted-foreground truncate">
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
                  <TableCell>{technician?.name ?? "Unassigned"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {job.scheduled_at ? format(new Date(job.scheduled_at), "PPp") : "—"}
                  </TableCell>
                  <TableCell>
                    <ProfitabilityPill value={profitability} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select value={job.status} onValueChange={(v) => actions.setJobCardStatus(job.id, v as JobCardStatus)}>
                        <SelectTrigger className="h-9 w-[140px]">
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
                      <JobSiteControlsDialog jobId={job.id} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
