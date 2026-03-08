import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { TRADES, type TradeId } from "@/features/company-signup/content/trades";
import { TRADE_JOB_CHECKLISTS } from "@/features/dashboard/constants/job-checklists";
import { tradeRequiresPower } from "@/features/loadshedding/hooks/use-loadshedding";
import { fromDatetimeLocal } from "@/features/dashboard/lib/datetime";
import { getJobSuggestions, suggestAssignee } from "@/features/dashboard/lib/job-suggestions";
import { parseScopeTemplateV1 } from "@/features/dashboard/components/sites/scope-template-builder";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import type { Database } from "@/integrations/supabase/types";
import { formatDistance } from "@/lib/geo";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

type JobCardStatus = Database["public"]["Enums"]["job_card_status"];
const STATUSES: JobCardStatus[] = ["new", "scheduled", "in-progress", "completed", "invoiced", "cancelled"];
const tradeIds = TRADES.map((t) => t.id) as [TradeId, ...TradeId[]];

const schema = z.object({
  tradeId: z.enum(tradeIds),
  title: z.string().min(2, "Job title is required"),
  description: z.string().optional(),
  status: z.enum(STATUSES as [JobCardStatus, ...JobCardStatus[]]),
  customerId: z.string().min(1, "Select a customer"),
  siteId: z.string().optional(),
  technicianId: z.string().optional(),
  scheduledAt: z.string().optional(),
  checklist: z.string().optional(),
  notes: z.string().optional(),
  requiresPower: z.boolean(),
});

type Values = z.infer<typeof schema>;

const NONE = "__none__";

export default function CreateJobCardDialog({
  defaultTradeId,
  allowedTradeIds,
}: {
  defaultTradeId: TradeId;
  allowedTradeIds?: readonly TradeId[] | null;
}) {
  const { data, actions } = useDashboardData();
  const [open, setOpen] = React.useState(false);

  const tradesForSelect = React.useMemo(() => {
    if (!allowedTradeIds || allowedTradeIds.length === 0) return TRADES;
    return TRADES.filter((t) => allowedTradeIds.includes(t.id));
  }, [allowedTradeIds]);

  const lockedTradeId = allowedTradeIds && allowedTradeIds.length === 1 ? allowedTradeIds[0] : null;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      tradeId: lockedTradeId ?? defaultTradeId,
      title: "",
      description: "",
      status: "new",
      customerId: data.customers[0]?.id ?? NONE,
      siteId: NONE,
      technicianId: NONE,
      scheduledAt: "",
      checklist: TRADE_JOB_CHECKLISTS[defaultTradeId].join("\n"),
      notes: "",
      requiresPower: tradeRequiresPower(defaultTradeId),
    },
    mode: "onTouched",
  });

  React.useEffect(() => {
    if (!open) return;
    const nextTradeId = lockedTradeId ?? defaultTradeId;
    form.setValue("tradeId", nextTradeId);
    form.setValue("checklist", TRADE_JOB_CHECKLISTS[nextTradeId].join("\n"));
    form.setValue("requiresPower", tradeRequiresPower(nextTradeId));
  }, [defaultTradeId, form, lockedTradeId, open]);

  React.useEffect(() => {
    if (!open) return;
    const current = form.getValues("customerId");
    if ((current === NONE || !current) && data.customers.length > 0) {
      form.setValue("customerId", data.customers[0].id, { shouldValidate: true });
    }
  }, [data.customers, form, open]);

  const tradeId = form.watch("tradeId") as TradeId;
  const customerId = form.watch("customerId");
  const siteId = form.watch("siteId");
  const technicianId = form.watch("technicianId");
  const sitesForCustomer = React.useMemo(
    () => data.sites.filter((s) => (s as any).customer_id === customerId),
    [customerId, data.sites],
  );
  const sitesForSelect = sitesForCustomer.length > 0 ? sitesForCustomer : data.sites;

  const selectedSite = React.useMemo(() => {
    if (!siteId || siteId === NONE) return null;
    return data.sites.find((s) => s.id === siteId) ?? null;
  }, [data.sites, siteId]);

  const assigneeSuggestion = React.useMemo(() => {
    const custId = customerId && customerId !== NONE ? customerId : null;
    const sid = siteId && siteId !== NONE ? siteId : null;
    const lat = selectedSite ? ((selectedSite as any).gps_lat as number | null | undefined) : null;
    const lng = selectedSite ? ((selectedSite as any).gps_lng as number | null | undefined) : null;
    const siteLatLng = typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng)
      ? { lat, lng }
      : null;

    return suggestAssignee({
      tradeId,
      customerId: custId,
      siteId: sid,
      siteLatLng,
      jobCards: data.jobCards as any,
      technicians: data.technicians as any,
      technicianLocations: data.technicianLocations as any,
    });
  }, [customerId, data.jobCards, data.technicianLocations, data.technicians, selectedSite, siteId, tradeId]);

  const suggestedTechnician = React.useMemo(() => {
    if (!assigneeSuggestion) return null;
    return data.technicians.find((t) => t.id === assigneeSuggestion.technicianId) ?? null;
  }, [assigneeSuggestion, data.technicians]);

  const smartJobSuggestions = React.useMemo(() => {
    const custId = customerId && customerId !== NONE ? customerId : null;
    const sid = siteId && siteId !== NONE ? siteId : null;
    return getJobSuggestions({
      tradeId,
      customerId: custId,
      siteId: sid,
      jobCards: data.jobCards as any,
      max: 6,
    });
  }, [customerId, data.jobCards, siteId, tradeId]);

  React.useEffect(() => {
    if (!open) return;
    if (!selectedSite) return;
    const siteCustomerId = (selectedSite as any)?.customer_id ?? null;
    if (!siteCustomerId) return;
    if (siteCustomerId !== form.getValues("customerId")) {
      form.setValue("customerId", siteCustomerId, { shouldDirty: true, shouldValidate: true, shouldTouch: true });
    }
  }, [form, open, selectedSite]);

  React.useEffect(() => {
    if (!open) return;
    const checklist = TRADE_JOB_CHECKLISTS[tradeId]?.join("\n") ?? "";
    form.setValue("checklist", checklist, { shouldDirty: true });
  }, [form, open, tradeId]);

  const submit = form.handleSubmit(async (values) => {
    if (!values.customerId || values.customerId === NONE) {
      form.setError("customerId", { type: "validate", message: "Select a customer" });
      toast({ title: "Select a customer", description: "Create a customer first, then create the job card.", variant: "destructive" });
      return;
    }
    const created = await actions.addJobCard({
      trade_id: values.tradeId,
      title: values.title,
      description: values.description || null,
      revenue_cents: null,
      status: values.status,
      customer_id: values.customerId,
      site_id: values.siteId && values.siteId !== NONE ? values.siteId : null,
      technician_id: values.technicianId && values.technicianId !== NONE ? values.technicianId : null,
      scheduled_at: values.scheduledAt ? fromDatetimeLocal(values.scheduledAt) ?? null : null,
      checklist: (values.checklist || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      notes: values.notes || null,
      requires_power: values.requiresPower,
    } as any);
    if (!created) return;
    toast({ title: "Job card created" });
    setOpen(false);
    form.reset({ ...form.getValues(), title: "", description: "", notes: "" });
  });

  const suggestedJobs = React.useMemo(() => {
    if (!selectedSite) return [];
    const tmpl = parseScopeTemplateV1((selectedSite as any)?.scope_template);
    if (!tmpl) return [];
    const existing = new Set(
      data.jobCards
        .filter((j) => j.site_id === selectedSite.id)
        .map((j) => String(j.title ?? "").toLowerCase().trim())
        .filter(Boolean),
    );
    const out: Array<{ stage: string; title: string }> = [];
    const seen = new Set<string>();
    for (const stage of tmpl.stages) {
      for (const job of stage.jobs) {
        const title = String(job.title ?? "").trim();
        if (!title) continue;
        const key = title.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        if (existing.has(key)) continue;
        out.push({ stage: stage.name || "Stage", title });
      }
    }
    return out;
  }, [data.jobCards, selectedSite]);

  const [creatingSuggested, setCreatingSuggested] = React.useState<string | null>(null);
  const createFromSuggestion = React.useCallback(async (s: { stage: string; title: string }) => {
    if (!selectedSite) return;
    const custId = form.getValues("customerId");
    if (!custId || custId === NONE) {
      form.setError("customerId", { type: "validate", message: "Select a customer" });
      toast({ title: "Select a customer", description: "Select a customer first, then create suggested jobs.", variant: "destructive" });
      return;
    }
    setCreatingSuggested(s.title);
    try {
      const created = await actions.addJobCard({
        trade_id: form.getValues("tradeId"),
        title: s.title,
        description: null,
        revenue_cents: null,
        status: "new",
        customer_id: custId,
        site_id: selectedSite.id,
        technician_id: null,
        scheduled_at: null,
        checklist: (form.getValues("checklist") || "")
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean),
        notes: `From site scope template · ${s.stage}`,
      } as any);
      if (created) toast({ title: "Job card created", description: s.title });
    } finally {
      setCreatingSuggested(null);
    }
  }, [actions, form, selectedSite]);

  const applySuggestion = React.useCallback((s: { title: string; reason?: string }) => {
    form.setValue("title", s.title, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    const currentNotes = String(form.getValues("notes") ?? "").trim();
    if (!currentNotes && s.reason) {
      form.setValue("notes", `Suggested: ${s.reason}`, { shouldDirty: true });
    }
    const techValue = form.getValues("technicianId");
    if ((techValue === NONE || !techValue) && assigneeSuggestion?.technicianId) {
      form.setValue("technicianId", assigneeSuggestion.technicianId, { shouldDirty: true, shouldTouch: true });
    }
  }, [assigneeSuggestion?.technicianId, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gradient-bg hover:opacity-90 shadow-glow">
          Create job card
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create job card</DialogTitle>
          <DialogDescription>Job cards are unified across trades, with trade-specific checklists.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {lockedTradeId ? (
                <div className="space-y-2 pt-1">
                  <div className="text-sm font-medium">Trade</div>
                  <div className="h-10 px-3 rounded-md border flex items-center text-sm text-muted-foreground">
                    {TRADES.find((t) => t.id === lockedTradeId)?.name ?? lockedTradeId}
                  </div>
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="tradeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trade</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select trade" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tradesForSelect.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Emergency call-out" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Short description of the work..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || NONE}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {data.customers.length === 0 ? (
                          <SelectItem value={NONE} disabled>
                            No customers yet
                          </SelectItem>
                        ) : (
                          <SelectItem value={NONE} disabled>
                            Select customer…
                          </SelectItem>
                        )}
                        {data.customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="siteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site (optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || NONE}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="No site" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>No site</SelectItem>
                        {sitesForSelect.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="technicianId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Technician (optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || NONE}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>Unassigned</SelectItem>
                        {data.technicians.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {suggestedTechnician && (technicianId === NONE || !technicianId) ? (
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="min-w-0 truncate">
                          Suggested: <span className="font-medium text-foreground">{suggestedTechnician.name}</span>
                          {" "}
                          <span className="text-muted-foreground">
                            — {assigneeSuggestion?.reason}
                            {typeof assigneeSuggestion?.distanceMeters === "number"
                              ? ` (${formatDistance(assigneeSuggestion.distanceMeters)})`
                              : ""}
                          </span>
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="link"
                          className="h-auto p-0 shrink-0"
                          onClick={() => form.setValue("technicianId", suggestedTechnician.id, { shouldDirty: true, shouldTouch: true })}
                        >
                          Assign
                        </Button>
                      </div>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {smartJobSuggestions.length > 0 ? (
              <Card className="bg-card/70 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Smart suggestions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Based on your existing customers, sites, and past job cards.
                  </div>
                  <div className="space-y-2">
                    {smartJobSuggestions.map((s) => (
                      <div key={s.title} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{s.title}</div>
                          <div className="mt-1">
                            <Badge variant="secondary" className="text-[10px]">
                              {s.reason}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => applySuggestion(s)}
                        >
                          Use
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {selectedSite && suggestedJobs.length > 0 ? (
              <Card className="bg-card/70 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Suggested jobs for {selectedSite.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Based on the site scope template. Click a suggestion to create a job card quickly.
                  </div>
                  <div className="space-y-2">
                    {suggestedJobs.slice(0, 10).map((s) => (
                      <div key={`${s.stage}:${s.title}`} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{s.title}</div>
                          <div className="mt-1">
                            <Badge variant="secondary" className="text-[10px]">
                              {s.stage}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          disabled={creatingSuggested != null}
                          onClick={() => void createFromSuggestion(s)}
                        >
                          {creatingSuggested === s.title ? "Creating…" : "Create"}
                        </Button>
                      </div>
                    ))}
                    {suggestedJobs.length > 10 ? (
                      <div className="text-xs text-muted-foreground">
                        +{suggestedJobs.length - 10} more suggestions. (Add them after creating these.)
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <FormField
              control={form.control}
              name="requiresPower"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0 rounded-md border border-border/40 px-3 py-2.5">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium cursor-pointer">Requires power ⚡</FormLabel>
                    <p className="text-xs text-muted-foreground">Flag this job for load shedding schedule checks</p>
                  </div>
                </FormItem>
              )}
            />


              control={form.control}
              name="scheduledAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scheduled (optional)</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="checklist"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Checklist</FormLabel>
                  <FormControl>
                    <Textarea rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Anything important for the tech..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" className="gradient-bg hover:opacity-90 shadow-glow" disabled={form.formState.isSubmitting}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
