import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TRADES } from "@/features/company-signup/content/trades";
import CreateJobCardDialog from "@/features/dashboard/components/dialogs/create-job-card-dialog";
import JobSiteControlsDialog from "@/features/dashboard/components/dialogs/job-site-controls-dialog";
import JobStatusBadge from "@/features/dashboard/components/job-status-badge";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardSelectors } from "@/features/dashboard/hooks/use-dashboard-selectors";
import { useTradeFilter } from "@/features/dashboard/hooks/use-trade-filter";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import type { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";

type JobCardStatus = Database["public"]["Enums"]["job_card_status"];
const STATUSES: JobCardStatus[] = ["new", "scheduled", "in-progress", "completed", "invoiced", "cancelled"];

export default function Jobs() {
  const { data, actions } = useDashboardData();
  const { trade } = useTradeFilter();
  const selectors = useDashboardSelectors(data, trade);

  const defaultTradeId = trade === "all" ? TRADES[0].id : trade;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job cards"
        subtitle="Create, assign, and track job cards across all service trades."
        actions={<CreateJobCardDialog defaultTradeId={defaultTradeId} />}
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
              <TableHead className="w-[220px]">Update</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {selectors.jobCards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  No job cards yet for this trade filter.
                </TableCell>
              </TableRow>
            ) : null}
            {selectors.jobCards.map((job) => {
              const customer = selectors.customersById.get(job.customer_id ?? "");
              const site = job.site_id ? selectors.sitesById.get(job.site_id) : undefined;
              const technician = job.technician_id ? selectors.techniciansById.get(job.technician_id) : undefined;
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
                  <TableCell>{site?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{technician?.name ?? "Unassigned"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {job.scheduled_at ? format(new Date(job.scheduled_at), "PPp") : "—"}
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
