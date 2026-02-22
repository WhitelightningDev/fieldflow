import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ManageInvoiceDialog from "@/features/dashboard/components/dialogs/manage-invoice-dialog";
import JobSiteControlsDialog from "@/features/dashboard/components/dialogs/job-site-controls-dialog";
import JobStatusBadge from "@/features/dashboard/components/job-status-badge";
import PageHeader from "@/features/dashboard/components/page-header";
import { isLast30Days, isLast7Days } from "@/features/dashboard/components/dashboard-kpi-utils";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import type { Tables } from "@/integrations/supabase/types";
import { formatZarFromCents } from "@/lib/money";
import { formatDistanceToNowStrict } from "date-fns";
import { FileText, RotateCcw, Wrench } from "lucide-react";
import * as React from "react";

export default function RepairHistory() {
  const { data } = useDashboardData();

  const [query, setQuery] = React.useState("");
  const [period, setPeriod] = React.useState<"7d" | "30d" | "all">("30d");
  const [status, setStatus] = React.useState<string>("completed_or_invoiced");

  const customersById = React.useMemo(() => new Map(data.customers.map((c) => [c.id, c] as const)), [data.customers]);
  const sitesById = React.useMemo(() => new Map(data.sites.map((s) => [s.id, s] as const)), [data.sites]);
  const techsById = React.useMemo(() => new Map(data.technicians.map((t) => [t.id, t] as const)), [data.technicians]);

  const invoicesByJobId = React.useMemo(() => {
    const m = new Map<string, Tables<"invoices">>();
    for (const inv of data.invoices) {
      const existing = m.get(inv.job_card_id);
      if (!existing) {
        m.set(inv.job_card_id, inv);
        continue;
      }
      if (new Date(inv.created_at).getTime() > new Date(existing.created_at).getTime()) {
        m.set(inv.job_card_id, inv);
      }
    }
    return m;
  }, [data.invoices]);

  const inPeriod = React.useCallback((iso: string) => {
    if (period === "all") return true;
    if (period === "7d") return isLast7Days(iso);
    return isLast30Days(iso);
  }, [period]);

  const isCallback = React.useCallback((job: Tables<"job_cards">) => {
    const notes = String(job.notes ?? "").toLowerCase();
    return notes.includes("callback") || notes.includes("return") || notes.includes("rework");
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.jobCards
      .filter((j) => j.trade_id === "appliance-repair")
      .filter((j) => inPeriod(j.updated_at))
      .filter((j) => {
        if (status === "all") return true;
        if (status === "completed_or_invoiced") return j.status === "completed" || j.status === "invoiced";
        return j.status === status;
      })
      .filter((j) => {
        if (!q) return true;
        const customer = j.customer_id ? customersById.get(j.customer_id) : null;
        const site = j.site_id ? sitesById.get(j.site_id) : null;
        const tech = j.technician_id ? techsById.get(j.technician_id) : null;
        const inv = invoicesByJobId.get(j.id) ?? null;
        const blob = [
          j.title,
          j.description,
          j.notes,
          j.status,
          customer?.name,
          customer?.email,
          site?.name,
          (site as any)?.address,
          tech?.name,
          inv?.invoice_number,
        ]
          .map((v) => String(v ?? "").toLowerCase())
          .join(" ");
        return blob.includes(q);
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [customersById, data.jobCards, inPeriod, invoicesByJobId, query, sitesById, status, techsById]);

  const stats = React.useMemo(() => {
    const total = filtered.length;
    const completed = filtered.filter((j) => j.status === "completed" || j.status === "invoiced").length;
    const callbacks = filtered.filter((j) => isCallback(j)).length;
    const collectedCents = filtered.reduce((sum, j) => {
      const inv = invoicesByJobId.get(j.id);
      if (!inv) return sum;
      return sum + (inv.amount_paid_cents ?? 0);
    }, 0);
    return { total, completed, callbacks, collectedCents };
  }, [filtered, invoicesByJobId, isCallback]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repair history"
        subtitle="View past appliance repairs and service records (jobs, invoices, payments)."
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Wrench className="h-4 w-4" /> Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <RotateCcw className="h-4 w-4" /> Callbacks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.callbacks}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatZarFromCents(stats.collectedCents)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search job, customer, site, invoice #…"
            />
            <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completed_or_invoiced">Completed + invoiced</SelectItem>
                <SelectItem value="all">All statuses</SelectItem>
                {["new", "scheduled", "in-progress", "completed", "invoiced", "cancelled"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border bg-card/70 backdrop-blur-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="w-[180px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-6 w-6 opacity-60" />
                    No repairs found for this filter.
                  </div>
                </TableCell>
              </TableRow>
            ) : null}

            {filtered.map((j) => {
              const customer = j.customer_id ? customersById.get(j.customer_id) : null;
              const site = j.site_id ? sitesById.get(j.site_id) : null;
              const tech = j.technician_id ? techsById.get(j.technician_id) : null;
              const inv = invoicesByJobId.get(j.id) ?? null;
              const revenue = typeof (j as any).revenue_cents === "number" ? (j as any).revenue_cents : null;
              return (
                <TableRow key={j.id}>
                  <TableCell>
                    <div className="font-medium">{j.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Updated {formatDistanceToNowStrict(new Date(j.updated_at), { addSuffix: true })}
                      {tech?.name ? ` • ${tech.name}` : ""}
                      {isCallback(j) ? (
                        <>
                          {" "}
                          • <Badge variant="secondary" className="text-[10px]">callback</Badge>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{customer?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{customer?.email ?? ""}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{site?.name ?? "—"}</TableCell>
                  <TableCell>
                    <JobStatusBadge status={j.status} />
                  </TableCell>
                  <TableCell>
                    {inv ? (
                      <div className="space-y-1">
                        <div className="font-medium">{inv.invoice_number}</div>
                        <Badge variant={inv.status === "paid" ? "default" : inv.status === "partial" ? "secondary" : "outline"} className="text-[10px]">
                          {inv.status}
                        </Badge>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No invoice</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {revenue != null ? formatZarFromCents(revenue) : inv ? formatZarFromCents(inv.amount_paid_cents ?? 0) : "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <JobSiteControlsDialog jobId={j.id} />
                    {inv ? <ManageInvoiceDialog invoiceId={inv.id} /> : null}
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
