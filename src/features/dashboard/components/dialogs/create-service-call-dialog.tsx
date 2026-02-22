import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { fromDatetimeLocal } from "@/features/dashboard/lib/datetime";
import {
  buildServiceCallNotes,
  buildServiceCallTitle,
  SERVICE_CALL_TYPES,
  type ServiceCallTag,
  type ServiceCallType,
  type ServiceCallUrgency,
} from "@/features/dashboard/lib/service-calls";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import type { Tables } from "@/integrations/supabase/types";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

type Customer = Tables<"customers">;
type Site = Tables<"sites">;

const urgencyOptions: { value: ServiceCallUrgency; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
  { value: "emergency", label: "Emergency" },
];

const callTypeValues = SERVICE_CALL_TYPES.map((t) => t.value) as [ServiceCallType, ...ServiceCallType[]];

const schema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  siteId: z.string().optional(),
  callType: z.enum(callTypeValues),
  urgency: z.enum(["normal", "urgent", "emergency"] as const),
  scheduledAt: z.string().optional(),
  description: z.string().min(2, "Add a short description"),
  callerName: z.string().optional(),
  callerPhone: z.string().optional(),
  address: z.string().optional(),
  accessNotes: z.string().optional(),
  reference: z.string().optional(),
  requiresPirbCoc: z.boolean().optional(),
  requiresGasCoc: z.boolean().optional(),
  requiresPressureTest: z.boolean().optional(),
  afterHours: z.boolean().optional(),
  insuranceClaim: z.boolean().optional(),
});

type Values = z.infer<typeof schema>;

const NONE = "__none__";

function dedupeSitesForCustomer(sites: Site[], customerId: string | null) {
  if (!customerId) return sites;
  const filtered = sites.filter((s: any) => String(s.customer_id ?? "") === customerId);
  return filtered.length ? filtered : sites;
}

export default function CreateServiceCallDialog() {
  const { data, actions } = useDashboardData();
  const [open, setOpen] = React.useState(false);

  const customers = data.customers as Customer[];
  const sites = data.sites as Site[];

  const defaultCustomerId = customers[0]?.id ?? NONE;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerId: defaultCustomerId,
      siteId: NONE,
      callType: "leak",
      urgency: "normal",
      scheduledAt: "",
      description: "",
      callerName: "",
      callerPhone: "",
      address: "",
      accessNotes: "",
      reference: "",
      requiresPirbCoc: false,
      requiresGasCoc: false,
      requiresPressureTest: false,
      afterHours: false,
      insuranceClaim: false,
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
  const sitesForSelect = React.useMemo(
    () => dedupeSitesForCustomer(sites, customerId && customerId !== NONE ? customerId : null),
    [customerId, sites],
  );

  const subtitle = React.useMemo(() => {
    const company = data.company as any;
    const fee = company?.callout_fee_cents ? Number(company.callout_fee_cents) : null;
    const radius = company?.callout_radius_km ? Number(company.callout_radius_km) : null;
    const feeText = Number.isFinite(fee) ? `Call-out fee R${(fee! / 100).toFixed(0)}` : "Call-out fee not set";
    const radiusText = Number.isFinite(radius) ? `${radius}km radius` : null;
    return [feeText, radiusText].filter(Boolean).join(" · ");
  }, [data.company]);

  const submit = form.handleSubmit(async (values) => {
    if (!values.customerId || values.customerId === NONE) {
      form.setError("customerId", { type: "validate", message: "Select a customer" });
      toast({ title: "Select a customer", description: "Create a customer first, then log the service call.", variant: "destructive" });
      return;
    }

    const tags: ServiceCallTag[] = ["service-call", values.callType];
    if (values.requiresPirbCoc) tags.push("pirb-coc");
    if (values.requiresGasCoc) tags.push("gas-coc");
    if (values.requiresPressureTest) tags.push("pressure-test");
    if (values.afterHours) tags.push("after-hours");
    if (values.insuranceClaim) tags.push("insurance");

    const scheduledIso = values.scheduledAt ? fromDatetimeLocal(values.scheduledAt) ?? null : null;
    const priority = values.urgency;

    const title = buildServiceCallTitle({ type: values.callType, urgency: values.urgency });
    const notes = buildServiceCallNotes({
      tags,
      callerName: values.callerName,
      callerPhone: values.callerPhone,
      address: values.address,
      accessNotes: values.accessNotes,
      reference: values.reference,
    });

    const created = await actions.addJobCard({
      trade_id: "plumbing",
      title,
      description: values.description || null,
      status: scheduledIso ? "scheduled" : "new",
      priority,
      customer_id: values.customerId,
      site_id: values.siteId && values.siteId !== NONE ? values.siteId : null,
      technician_id: null,
      scheduled_at: scheduledIso,
      revenue_cents: null,
      notes: notes || null,
      checklist: [
        "Confirm issue and isolate water if required",
        "Capture before photos",
        "Record parts used (fittings, valves, sealant)",
        "Pressure/leak test",
        "Capture after photos and customer sign-off",
      ],
    } as any);

    if (!created) return;
    toast({ title: "Service call logged" });
    setOpen(false);
    form.reset({ ...form.getValues(), description: "", address: "", accessNotes: "", reference: "" });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gradient-bg hover:opacity-90 shadow-glow">
          Log service call
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log service call</DialogTitle>
          <DialogDescription>Capture dispatch-ready details for a South African plumbing call-out.</DialogDescription>
        </DialogHeader>

        {subtitle ? (
          <div className="-mt-1 text-xs text-muted-foreground">
            {subtitle}
          </div>
        ) : null}

        <Form {...form}>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="callType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Call type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select call type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SERVICE_CALL_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
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
                name="urgency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Urgency</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {urgencyOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Problem description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g. Burst pipe in ceiling, water shutoff unknown, tenant on site…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                        <SelectItem value={NONE}>No site (use address)</SelectItem>
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="scheduledAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dispatch time (optional)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Street, suburb, city" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="callerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Caller name (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Tenant / landlord / manager" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="callerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Caller phone (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="082 123 4567" {...field} />
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
                      <Input placeholder="PO / insurance claim / job ref" {...field} />
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
                      <Input placeholder="Gate code, keys, parking, water shutoff location…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-lg border bg-card/70 p-3 space-y-3">
              <div className="text-sm font-medium">Compliance & flags</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="requiresPirbCoc"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={Boolean(field.value)} onCheckedChange={(v) => field.onChange(Boolean(v))} />
                        <FormLabel className="m-0">PIRB plumbing CoC required</FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="requiresPressureTest"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={Boolean(field.value)} onCheckedChange={(v) => field.onChange(Boolean(v))} />
                        <FormLabel className="m-0">Pressure test required</FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="requiresGasCoc"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={Boolean(field.value)} onCheckedChange={(v) => field.onChange(Boolean(v))} />
                        <FormLabel className="m-0">Gas compliance CoC (LPG) required</FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="afterHours"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={Boolean(field.value)} onCheckedChange={(v) => field.onChange(Boolean(v))} />
                        <FormLabel className="m-0">After-hours call-out</FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="insuranceClaim"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={Boolean(field.value)} onCheckedChange={(v) => field.onChange(Boolean(v))} />
                        <FormLabel className="m-0">Insurance claim</FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                These flags are stored as #tags in the job notes for easy filtering.
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" className="gradient-bg hover:opacity-90 shadow-glow" disabled={form.formState.isSubmitting}>
                Save service call
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
