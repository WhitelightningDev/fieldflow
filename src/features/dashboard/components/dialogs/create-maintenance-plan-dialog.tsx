import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { fromDatetimeLocal, toDatetimeLocal } from "@/features/dashboard/lib/datetime";
import { buildMaintenanceNotes, formatRepeat, type MaintenanceRepeat } from "@/features/dashboard/lib/maintenance";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import type { Tables } from "@/integrations/supabase/types";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

type Customer = Tables<"customers">;
type Site = Tables<"sites">;
type Technician = Tables<"technicians">;

const repeats: MaintenanceRepeat[] = ["weekly", "monthly", "quarterly", "biannual", "annual"];

const schema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  siteId: z.string().optional(),
  technicianId: z.string().optional(),
  title: z.string().min(2, "Title is required"),
  repeat: z.enum(repeats as [MaintenanceRepeat, ...MaintenanceRepeat[]]),
  interval: z.coerce.number().int().min(1).max(48),
  firstDueAt: z.string().min(1, "Select first due date/time"),
  reference: z.string().optional(),
  accessNotes: z.string().optional(),
  checklist: z.string().optional(),
  internalNotes: z.string().optional(),
});

type Values = z.infer<typeof schema>;

const NONE = "__none__";

const DEFAULT_CHECKLIST = [
  "Confirm scope and isolate water if required",
  "Inspect visible pipework, fittings, and valves",
  "Check geyser / pressure relief valve (if applicable)",
  "Check for leaks at toilets, basins, and taps",
  "Record readings / observations in notes",
  "Capture photos (before/after if repairs)",
  "Record parts used and schedule follow-ups if needed",
  "Customer sign-off",
];

export default function CreateMaintenancePlanDialog({ onCreated }: { onCreated?: () => void }) {
  const { data, actions } = useDashboardData();
  const [open, setOpen] = React.useState(false);

  const customers = data.customers as Customer[];
  const sites = data.sites as Site[];
  const technicians = data.technicians as Technician[];

  const defaultCustomerId = customers[0]?.id ?? NONE;
  const nowLocal = React.useMemo(() => toDatetimeLocal(new Date().toISOString()), []);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerId: defaultCustomerId,
      siteId: NONE,
      technicianId: NONE,
      title: "Preventative maintenance",
      repeat: "monthly",
      interval: 1,
      firstDueAt: nowLocal,
      reference: "",
      accessNotes: "",
      checklist: DEFAULT_CHECKLIST.join("\n"),
      internalNotes: "",
    },
    mode: "onTouched",
  });

  React.useEffect(() => {
    if (!open) return;
    const current = form.getValues("customerId");
    if ((current === NONE || !current) && customers.length > 0) {
      form.setValue("customerId", customers[0].id, { shouldValidate: true });
    }
  }, [customers, form, open]);

  const customerId = form.watch("customerId");
  const sitesForCustomer = React.useMemo(() => {
    if (!customerId || customerId === NONE) return sites;
    const filtered = sites.filter((s: any) => String(s.customer_id ?? "") === customerId);
    return filtered.length ? filtered : sites;
  }, [customerId, sites]);

  const submit = form.handleSubmit(async (values) => {
    if (!values.customerId || values.customerId === NONE) {
      toast({ title: "Select a customer", description: "Create/select a customer first.", variant: "destructive" });
      return;
    }
    const dueIso = fromDatetimeLocal(values.firstDueAt);
    if (!dueIso) {
      toast({ title: "Invalid due date", variant: "destructive" });
      return;
    }

    const msid = crypto.randomUUID();
    const notes = buildMaintenanceNotes({
      msid,
      repeat: values.repeat,
      interval: values.interval,
      reference: values.reference,
      accessNotes: values.accessNotes,
      internalNotes: values.internalNotes,
    });

    const siteId = values.siteId && values.siteId !== NONE ? values.siteId : null;
    const site = siteId ? sites.find((s) => s.id === siteId) : null;

    const title = site?.name
      ? `Maintenance: ${site.name} — ${values.title}`
      : `Maintenance: ${values.title}`;

    const checklist = (values.checklist || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const created = await actions.addJobCard({
      trade_id: "plumbing",
      title,
      description: `${formatRepeat(values.repeat, values.interval)}${site?.address ? ` • ${site.address}` : ""}`,
      status: "scheduled",
      priority: "normal",
      customer_id: values.customerId,
      site_id: siteId,
      technician_id: values.technicianId && values.technicianId !== NONE ? values.technicianId : null,
      scheduled_at: dueIso,
      revenue_cents: null,
      notes,
      checklist,
    } as any);

    if (!created) return;
    toast({ title: "Maintenance plan created" });
    setOpen(false);
    onCreated?.();
    form.reset({ ...form.getValues(), title: "Preventative maintenance", internalNotes: "" });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gradient-bg hover:opacity-90 shadow-glow">
          Create maintenance plan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create maintenance plan</DialogTitle>
          <DialogDescription>Creates a recurring plumbing maintenance schedule backed by scheduled job cards.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
                        {customers.length === 0 ? (
                          <SelectItem value={NONE} disabled>
                            No customers yet
                          </SelectItem>
                        ) : (
                          <SelectItem value={NONE} disabled>
                            Select customer…
                          </SelectItem>
                        )}
                        {customers.map((c) => (
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
                          <SelectValue placeholder="Select site" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>No site</SelectItem>
                        {sitesForCustomer.map((s) => (
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="technicianId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default technician (optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || NONE}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>Unassigned</SelectItem>
                        {technicians.map((t) => (
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

              <FormField
                control={form.control}
                name="firstDueAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First due</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
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
                  <FormLabel>Plan title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Preventative maintenance" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="repeat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repeat</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="biannual">Biannual</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="interval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interval</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={48} step={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="PO / contract ref" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accessNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access notes (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Gate code, keys, parking…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="checklist"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Checklist (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={7} placeholder="One item per line…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="internalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="Extra instructions for the technician…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" className="gradient-bg hover:opacity-90 shadow-glow" disabled={form.formState.isSubmitting}>
                Create plan
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

