import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/use-toast";
import { TRADES } from "@/features/company-signup/content/trades";
import JobSiteControlsDialog from "@/features/dashboard/components/dialogs/job-site-controls-dialog";
import JobStatusBadge from "@/features/dashboard/components/job-status-badge";
import ProfitabilityPill from "@/features/dashboard/components/profitability-pill";
import { fromDatetimeLocal, toDatetimeLocal } from "@/features/dashboard/lib/datetime";
import { computeJobProfitability } from "@/features/dashboard/lib/profitability";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import type { Database, Tables, TablesUpdate } from "@/integrations/supabase/types";
import { formatZarFromCents } from "@/lib/money";
import { format } from "date-fns";
import { Copy, ExternalLink, MapPin } from "lucide-react";
import * as React from "react";

type JobCardStatus = Database["public"]["Enums"]["job_card_status"];
const STATUSES: JobCardStatus[] = ["new", "scheduled", "in-progress", "completed", "invoiced", "cancelled"];
const NONE = "__none__";

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied" });
  } catch {
    toast({ title: "Copy failed", variant: "destructive" });
  }
}

export default function JobCardDetailSheet({
  jobId,
  open,
  onOpenChange,
}: {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, actions } = useDashboardData();

  const job = React.useMemo(() => {
    if (!jobId) return null;
    return (data.jobCards.find((j) => j.id === jobId) ?? null) as (Tables<"job_cards"> | null);
  }, [data.jobCards, jobId]);

  const customer = React.useMemo(() => {
    if (!job?.customer_id) return null;
    return (data.customers.find((c) => c.id === job.customer_id) ?? null) as (Tables<"customers"> | null);
  }, [data.customers, job?.customer_id]);

  const site = React.useMemo(() => {
    if (!job?.site_id) return null;
    return (data.sites.find((s) => s.id === job.site_id) ?? null) as (Tables<"sites"> | null);
  }, [data.sites, job?.site_id]);

  const technician = React.useMemo(() => {
    if (!job?.technician_id) return null;
    return (data.technicians.find((t) => t.id === job.technician_id) ?? null) as (Tables<"technicians"> | null);
  }, [data.technicians, job?.technician_id]);

  const [draft, setDraft] = React.useState({
    status: "new" as JobCardStatus,
    scheduledAt: "",
    technicianId: NONE,
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open || !job) return;
    setDraft({
      status: (job.status ?? "new") as JobCardStatus,
      scheduledAt: toDatetimeLocal(job.scheduled_at ?? undefined),
      technicianId: job.technician_id ?? NONE,
    });
  }, [job, open]);

  const timeEntriesForJob = React.useMemo(() => data.jobTimeEntries.filter((e) => e.job_card_id === jobId), [data.jobTimeEntries, jobId]);
  const materialsForJob = React.useMemo(() => data.siteMaterialUsage.filter((m) => m.job_card_id === jobId), [data.siteMaterialUsage, jobId]);

  const techniciansById = React.useMemo(() => new Map(data.technicians.map((t) => [t.id, t])), [data.technicians]);
  const inventoryById = React.useMemo(() => new Map(data.inventoryItems.map((i) => [i.id, i])), [data.inventoryItems]);

  const profitability = React.useMemo(() => {
    if (!job) return null;
    return computeJobProfitability({
      job,
      timeEntries: timeEntriesForJob,
      materials: materialsForJob,
      techniciansById,
      inventoryById,
    });
  }, [inventoryById, job, materialsForJob, techniciansById, timeEntriesForJob]);

  const tradeName = job ? (TRADES.find((t) => t.id === job.trade_id)?.name ?? job.trade_id) : "";

  const saveBasics = async () => {
    if (!job) return;
    setSaving(true);
    const patch: TablesUpdate<"job_cards"> = {
      status: draft.status,
      technician_id: draft.technicianId && draft.technicianId !== NONE ? draft.technicianId : null,
      scheduled_at: draft.scheduledAt ? fromDatetimeLocal(draft.scheduledAt) ?? null : null,
    };
    const updated = await actions.updateJobCard(job.id, patch);
    setSaving(false);
    if (!updated) return;
    toast({ title: "Job updated" });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl lg:max-w-3xl p-0">
        <div className="border-b border-border/60 p-6">
          <SheetHeader className="space-y-1">
            <div className="flex items-start justify-between gap-3 pr-8">
              <div className="min-w-0">
                <SheetTitle className="truncate">{job?.title ?? "Job card"}</SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono text-[12px]">{job?.id ? job.id.slice(0, 8) : "—"}</span>
                  {job?.id ? (
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => void copy(job.id)}>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copy ID
                    </Button>
                  ) : null}
                </SheetDescription>
              </div>
              {job?.status ? <JobStatusBadge status={job.status as JobCardStatus} /> : null}
            </div>
          </SheetHeader>
        </div>

        <div className="max-h-[calc(100dvh-88px)] overflow-y-auto p-6 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="bg-card/70 backdrop-blur-sm sm:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Trade</div>
                    <div className="font-medium">{tradeName || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Scheduled</div>
                    <div className="font-medium">
                      {job?.scheduled_at ? format(new Date(job.scheduled_at), "dd MMM yyyy, HH:mm") : "Not scheduled"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Customer</div>
                    <div className="font-medium">{customer?.name ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Technician</div>
                    <div className="font-medium">{technician?.name ?? "Unassigned"}</div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Site</div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium">{site?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                        {site?.address ?? "No address"}
                      </div>
                    </div>
                  </div>
                </div>

                {job?.description?.trim() ? (
                  <>
                    <Separator />
                    <div>
                      <div className="text-xs text-muted-foreground">Description</div>
                      <div className="whitespace-pre-wrap break-words">{job.description.trim()}</div>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card className="bg-card/70 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={draft.status} onValueChange={(v) => setDraft((p) => ({ ...p, status: v as JobCardStatus }))}>
                    <SelectTrigger className="h-9">
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
                </div>

                <div className="space-y-1">
                  <Label>Technician</Label>
                  <Select value={draft.technicianId} onValueChange={(v) => setDraft((p) => ({ ...p, technicianId: v }))}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Unassigned</SelectItem>
                      {data.technicians.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Schedule</Label>
                  <Input
                    type="datetime-local"
                    value={draft.scheduledAt}
                    onChange={(e) => setDraft((p) => ({ ...p, scheduledAt: e.target.value }))}
                    className="h-9"
                  />
                </div>

                <Button onClick={() => void saveBasics()} disabled={!job || saving} className="w-full">
                  {saving ? "Saving..." : "Save changes"}
                </Button>

                {job ? (
                  <JobSiteControlsDialog
                    jobId={job.id}
                    trigger={
                      <Button variant="outline" className="w-full gap-2">
                        <ExternalLink className="h-4 w-4" />
                        Open full job card
                      </Button>
                    }
                  />
                ) : null}
              </CardContent>
            </Card>
          </div>

          {profitability ? (
            <Card className="bg-card/70 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm">Profitability</CardTitle>
                  <ProfitabilityPill value={profitability} />
                </div>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Revenue</div>
                    <div className="font-medium">{profitability.revenueCents === null ? "—" : formatZarFromCents(profitability.revenueCents)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Labour</div>
                    <div className="font-medium">{formatZarFromCents(profitability.laborCostCents)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Materials</div>
                    <div className="font-medium">{formatZarFromCents(profitability.materialCostCents)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Waste</div>
                    <div className="font-medium">{formatZarFromCents(profitability.wasteCostCents)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {job?.updated_at ? (
            <div className="text-xs text-muted-foreground">
              Last updated {format(new Date(job.updated_at), "dd MMM yyyy, HH:mm")}.
              {job.status ? (
                <span className="ml-2">
                  <Badge variant="outline">{job.status}</Badge>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
