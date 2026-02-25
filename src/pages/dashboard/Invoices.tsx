import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageHeader from "@/features/dashboard/components/page-header";
import ManageInvoiceDialog from "@/features/dashboard/components/dialogs/manage-invoice-dialog";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import type { Tables } from "@/integrations/supabase/types";
import { formatZarFromCents } from "@/lib/money";
import { FileText } from "lucide-react";
import * as React from "react";
import { useFeatureGate } from "@/features/subscription/hooks/use-feature-gate";
import UpgradePrompt from "@/features/subscription/components/upgrade-prompt";

type Invoice = Tables<"invoices">;

function norm(v: unknown) {
  return String(v ?? "").toLowerCase().trim();
}

function centsOrZero(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

const STATUS_OPTIONS = ["all", "draft", "sent", "partial", "paid"] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

export default function Invoices() {
  const { data } = useDashboardData();
  const company = data.company as any;
  const gate = useFeatureGate(company?.subscription_tier);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");

  const customersById = React.useMemo(() => new Map(data.customers.map((c) => [c.id, c] as const)), [data.customers]);
  const jobsById = React.useMemo(() => new Map(data.jobCards.map((j) => [j.id, j] as const)), [data.jobCards]);
  const sitesById = React.useMemo(() => new Map(data.sites.map((s) => [s.id, s] as const)), [data.sites]);

  const filtered = React.useMemo(() => {
    if (!gate.hasFeature("invoicing")) return [];
    const q = norm(query);
    const rows = (data.invoices ?? []) as Invoice[];
    return rows.filter((inv) => {
      if (status !== "all" && String(inv.status ?? "") !== status) return false;
      if (!q) return true;
      const customer = inv.customer_id ? customersById.get(inv.customer_id) : null;
      const job = jobsById.get(inv.job_card_id);
      const site = job?.site_id ? sitesById.get(job.site_id) : null;
      const blob = [
        inv.invoice_number,
        inv.status,
        customer?.name,
        customer?.email,
        job?.title,
        site?.name,
        (site as any)?.address,
      ]
        .map(norm)
        .join(" ");
      return blob.includes(q);
    });
  }, [customersById, data.invoices, gate, jobsById, query, sitesById, status]);

  const stats = React.useMemo(() => {
    const rows = filtered;
    const draft = rows.filter((i) => i.status === "draft").length;
    const sent = rows.filter((i) => i.status === "sent").length;
    const partial = rows.filter((i) => i.status === "partial").length;
    const paid = rows.filter((i) => i.status === "paid").length;
    const outstandingCents = rows.reduce((sum, i) => sum + Math.max(0, (i.total_cents ?? 0) - (i.amount_paid_cents ?? 0)), 0);
    const collectedCents = rows.reduce((sum, i) => sum + centsOrZero(i.amount_paid_cents), 0);
    return { draft, sent, partial, paid, outstandingCents, collectedCents };
  }, [filtered]);

  if (!gate.hasFeature("invoicing")) {
    return <UpgradePrompt feature="Invoicing" requiredTier="pro" currentTier={gate.tier} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Track invoice status, record payments, and keep customer billing organised."
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Draft</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sent}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Partial</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.partial}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.paid}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-sm col-span-2 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Collected / Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatZarFromCents(stats.collectedCents)}</span>
              <span className="text-muted-foreground"> / </span>
              <span className="font-semibold text-destructive">{formatZarFromCents(stats.outstandingCents)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search invoice #, customer, job, site…"
            />
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">draft</SelectItem>
                <SelectItem value="sent">sent</SelectItem>
                <SelectItem value="partial">partial</SelectItem>
                <SelectItem value="paid">paid</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground flex items-center">
              Showing <span className="mx-1 font-medium text-foreground">{filtered.length}</span> invoice{filtered.length === 1 ? "" : "s"}.
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border bg-card/70 backdrop-blur-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Job / Site</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-6 w-6 opacity-60" />
                    No invoices found.
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
            {filtered.map((inv) => {
              const customer = inv.customer_id ? customersById.get(inv.customer_id) : null;
              const job = jobsById.get(inv.job_card_id) as any;
              const site = job?.site_id ? sitesById.get(job.site_id) : null;
              const total = inv.total_cents ?? 0;
              const paid = inv.amount_paid_cents ?? 0;
              const balance = Math.max(0, total - paid);
              return (
                <TableRow key={inv.id}>
                  <TableCell>
                    <div className="font-medium">{inv.invoice_number}</div>
                    <div className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{customer?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{customer?.email ?? ""}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{job?.title ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{site?.name ?? "No site"}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={inv.status === "paid" ? "default" : inv.status === "partial" ? "secondary" : "outline"}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatZarFromCents(total)}</TableCell>
                  <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{formatZarFromCents(paid)}</TableCell>
                  <TableCell className="text-right">
                    {balance > 0 ? <span className="text-destructive">{formatZarFromCents(balance)}</span> : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <ManageInvoiceDialog invoiceId={inv.id} />
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

