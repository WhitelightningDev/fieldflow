import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ManageInvoiceDialog from "@/features/dashboard/components/dialogs/manage-invoice-dialog";
import JobSiteControlsDialog from "@/features/dashboard/components/dialogs/job-site-controls-dialog";
import JobStatusBadge from "@/features/dashboard/components/job-status-badge";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import type { Tables } from "@/integrations/supabase/types";
import { formatZarFromCents } from "@/lib/money";
import { formatDistanceToNowStrict } from "date-fns";
import { FileText, PackageSearch, ShieldCheck } from "lucide-react";
import * as React from "react";

export default function WarrantyTracker() {
  const { data } = useDashboardData();

  const [query, setQuery] = React.useState("");
  const [jobStatus, setJobStatus] = React.useState<string>("all");
  const [invoiceStatus, setInvoiceStatus] = React.useState<string>("all");

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

  const isWarrantyJob = React.useCallback((job: Tables<"job_cards">) => {
    const hay = `${job.title ?? ""} ${job.description ?? ""} ${job.notes ?? ""}`.toLowerCase();
    return hay.includes("warranty") || hay.includes("#warranty") || hay.includes("wty");
  }, []);

  const isAwaitingParts = React.useCallback((job: Tables<"job_cards">) => {
    const notes = String(job.notes ?? "").toLowerCase();
    return notes.includes("awaiting parts") || notes.includes("back order") || notes.includes("backorder");
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.jobCards
      .filter((j) => j.trade_id === "appliance-repair")
      .filter((j) => isWarrantyJob(j))
      .filter((j) => {
        if (jobStatus !== "all" && j.status !== jobStatus) return false;
        const inv = invoicesByJobId.get(j.id) ?? null;
        if (invoiceStatus !== "all") {
          if (invoiceStatus === "missing") return !inv;
          if (!inv) return false;
          return String(inv.status ?? "") === invoiceStatus;
        }
        if (!q) return true;
        const customer = j.customer_id ? customersById.get(j.customer_id) : null;
        const site = j.site_id ? sitesById.get(j.site_id) : null;
        const tech = j.technician_id ? techsById.get(j.technician_id) : null;
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
  }, [customersById, data.jobCards, invoiceStatus, invoicesByJobId, isWarrantyJob, jobStatus, query, sitesById, techsById]);

  const stats = React.useMemo(() => {
    const total = filtered.length;
    const awaitingParts = filtered.filter((j) => isAwaitingParts(j)).length;
    const open = filtered.filter((j) => !["cancelled", "invoiced"].includes(j.status)).length;
    const outstanding = filtered.reduce((sum, j) => {
      const inv = invoicesByJobId.get(j.id);
      if (!inv) return sum;
      const totalCents = inv.total_cents ?? 0;
      const paidCents = inv.amount_paid_cents ?? 0;
      return sum + Math.max(0, totalCents - paidCents);
    }, 0);
    return { total, awaitingParts, open, outstanding };
  }, [filtered, invoicesByJobId, isAwaitingParts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warranty tracker"
        subtitle="Track warranty-related appliance repair jobs, invoice status, and outstanding balances."
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Warranty jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.open}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <PackageSearch className="h-4 w-4" /> Awaiting parts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.awaitingParts}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatZarFromCents(stats.outstanding)}</div>
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
            <Select value={jobStatus} onValueChange={setJobStatus}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All job statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All job statuses</SelectItem>
                {["new", "scheduled", "in-progress", "completed", "invoiced", "cancelled"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All invoice statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All invoice statuses</SelectItem>
                <SelectItem value="missing">missing</SelectItem>
                {["draft", "sent", "partial", "paid"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground">
            Warranty jobs are detected when the job title/description/notes contain the word <span className="font-medium text-foreground">warranty</span>.
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
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="w-[180px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-6 w-6 opacity-60" />
                    No warranty jobs found.
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
            {filtered.map((j) => {
              const customer = j.customer_id ? customersById.get(j.customer_id) : null;
              const site = j.site_id ? sitesById.get(j.site_id) : null;
              const tech = j.technician_id ? techsById.get(j.technician_id) : null;
              const inv = invoicesByJobId.get(j.id) ?? null;
              const total = inv?.total_cents ?? 0;
              const paid = inv?.amount_paid_cents ?? 0;
              const balance = inv ? Math.max(0, total - paid) : null;

              return (
                <TableRow key={j.id}>
                  <TableCell>
                    <div className="font-medium">{j.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Updated {formatDistanceToNowStrict(new Date(j.updated_at), { addSuffix: true })}
                      {tech?.name ? ` • ${tech.name}` : ""}
                      {isAwaitingParts(j) ? (
                        <>
                          {" "}
                          • <Badge variant="secondary" className="text-[10px]">awaiting parts</Badge>
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
                    {balance == null ? (
                      "—"
                    ) : balance > 0 ? (
                      <span className="text-destructive font-medium">{formatZarFromCents(balance)}</span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatZarFromCents(0)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <JobSiteControlsDialog jobId={j.id} />
                    {inv ? (
                      <ManageInvoiceDialog invoiceId={inv.id} />
                    ) : (
                      <Button size="sm" variant="outline" disabled title="Invoice is created from the technician job flow (Invoice step).">
                        Invoice
                      </Button>
                    )}
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
