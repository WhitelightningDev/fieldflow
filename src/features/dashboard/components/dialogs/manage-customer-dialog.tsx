import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import JobStatusBadge from "@/features/dashboard/components/job-status-badge";
import JobSiteControlsDialog from "@/features/dashboard/components/dialogs/job-site-controls-dialog";
import ManageSiteDialog from "@/features/dashboard/components/dialogs/manage-site-dialog";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import type { Tables } from "@/integrations/supabase/types";
import { formatZarFromCents } from "@/lib/money";
import { formatDistanceToNowStrict } from "date-fns";
import { Mail, MapPin, Phone, Receipt, Users } from "lucide-react";
import * as React from "react";

type Customer = Tables<"customers">;
type JobCard = Tables<"job_cards">;
type Site = Tables<"sites">;
type Technician = Tables<"technicians">;

function centsOrZero(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export default function ManageCustomerDialog({ customerId }: { customerId: string }) {
  const { data, actions } = useDashboardData();
  const [open, setOpen] = React.useState(false);

  const customer = data.customers.find((c) => c.id === customerId) as Customer | undefined;
  const sites = React.useMemo(() => data.sites.filter((s) => (s as any).customer_id === customerId) as Site[], [customerId, data.sites]);
  const siteById = React.useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);
  const techniciansById = React.useMemo(() => new Map(data.technicians.map((t) => [t.id, t])), [data.technicians]);

  const jobs = React.useMemo(() => {
    return data.jobCards
      .filter((j) => (j as any).customer_id === customerId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()) as JobCard[];
  }, [customerId, data.jobCards]);

  const metrics = React.useMemo(() => {
    const activeJobs = jobs.filter((j) => !["completed", "invoiced", "cancelled"].includes(j.status));
    const unbilledJobs = jobs.filter((j) => j.status === "completed");
    const invoicedJobs = jobs.filter((j) => j.status === "invoiced");
    const unbilledRevenue = unbilledJobs.reduce((sum, j) => sum + centsOrZero((j as any).revenue_cents), 0);
    const totalRevenue = jobs.reduce((sum, j) => sum + centsOrZero((j as any).revenue_cents), 0);
    const techIds = new Set<string>();
    for (const j of jobs) {
      const tid = (j as any).technician_id;
      if (typeof tid === "string" && tid) techIds.add(tid);
    }
    return {
      activeJobs,
      unbilledJobs,
      invoicedJobs,
      unbilledRevenue,
      totalRevenue,
      techCount: techIds.size,
    };
  }, [jobs]);

  if (!customer) return null;

  const code = (customer as any).code as string | null | undefined;
  const vat = (customer as any).vat_number as string | null | undefined;
  const billingRef = (customer as any).billing_reference as string | null | undefined;
  const billingEmail = (customer as any).billing_email as string | null | undefined;
  const billingPhone = (customer as any).billing_phone as string | null | undefined;
  const paymentTerms = (customer as any).payment_terms as string | null | undefined;

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
            <span className="min-w-0 truncate">{customer.name}</span>
            <div className="flex items-center gap-2 shrink-0">
              {code ? <Badge variant="secondary">{code}</Badge> : null}
              {billingRef ? <Badge variant="outline">{billingRef}</Badge> : null}
            </div>
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {customer.phone || "—"}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {customer.email || "—"}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {customer.address || "—"}
              </span>
            </div>
            {vat || paymentTerms || billingEmail || billingPhone ? (
              <div className="text-xs text-muted-foreground">
                {vat ? `VAT: ${vat}` : null}
                {vat && paymentTerms ? " • " : null}
                {paymentTerms ? `Terms: ${paymentTerms}` : null}
                {(vat || paymentTerms) && (billingEmail || billingPhone) ? " • " : null}
                {billingEmail ? `Billing: ${billingEmail}` : billingPhone ? `Billing: ${billingPhone}` : null}
              </div>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full flex-1 min-h-0 overflow-hidden flex flex-col">
          <TabsList className="shrink-0 w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sites">Sites</TabsTrigger>
            <TabsTrigger value="jobs">Jobs & Invoices</TabsTrigger>
          </TabsList>

          <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-card/70 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                      <Receipt className="h-4 w-4" /> Unbilled
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatZarFromCents(metrics.unbilledRevenue)}</div>
                    <div className="text-xs text-muted-foreground">{metrics.unbilledJobs.length} completed job cards</div>
                  </CardContent>
                </Card>

                <Card className="bg-card/70 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                      <Receipt className="h-4 w-4" /> Total revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatZarFromCents(metrics.totalRevenue)}</div>
                    <div className="text-xs text-muted-foreground">{jobs.length} segmented job cards</div>
                  </CardContent>
                </Card>

                <Card className="bg-card/70 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                      <Users className="h-4 w-4" /> Techs involved
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.techCount}</div>
                    <div className="text-xs text-muted-foreground">based on assigned jobs</div>
                  </CardContent>
                </Card>

                <Card className="bg-card/70 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Sites
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{sites.length}</div>
                    <div className="text-xs text-muted-foreground">{metrics.activeJobs.length} active jobs</div>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-xl border bg-card/70 backdrop-blur-sm p-4 text-sm space-y-2">
                <div className="font-medium">Billing checklist</div>
                <div className="text-muted-foreground">
                  {billingEmail ? "Billing email set" : "Set a billing email for invoice delivery."}
                  {" • "}
                  {vat ? "VAT number set" : "Add VAT number if required on invoices."}
                  {" • "}
                  {paymentTerms ? "Payment terms set" : "Add payment terms (e.g. EFT 30 days)."}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="sites" className="space-y-4">
              <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Site</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead className="w-[140px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sites.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                          No sites for this customer yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {sites.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.address ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <ManageSiteDialog siteId={s.id} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="jobs" className="space-y-4">
              <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead className="w-[240px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                          No job cards yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {jobs.map((j) => {
                      const siteName = (j as any).site_id ? siteById.get((j as any).site_id)?.name : null;
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
                          <TableCell className="text-sm text-muted-foreground">{siteName ?? "—"}</TableCell>
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

