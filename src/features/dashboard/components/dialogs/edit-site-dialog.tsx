import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import LatLngPickerDialog from "@/components/maps/lat-lng-picker-dialog";
import ScopeTemplateBuilder, { type ScopeTemplateV1, normalizeScopeTemplate, parseScopeTemplateV1 } from "@/features/dashboard/components/sites/scope-template-builder";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const NONE = "__none__";

const schema = z.object({
  name: z.string().min(2, "Site name is required"),
  customerId: z.string().optional(),
  code: z.string().optional(),
  billingReference: z.string().optional(),
  address: z.string().optional(),
  gpsLat: z.string().optional(),
  gpsLng: z.string().optional(),
  scopeOfWork: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
  notes: z.string().optional(),
}).superRefine((v, ctx) => {
  const latStr = String(v.gpsLat ?? "").trim();
  const lngStr = String(v.gpsLng ?? "").trim();
  const hasLat = latStr.length > 0;
  const hasLng = lngStr.length > 0;

  if (!hasLat && !hasLng) return;
  if (hasLat !== hasLng) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["gpsLat"], message: "Enter both GPS latitude and longitude (or leave both blank)." });
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["gpsLng"], message: "Enter both GPS latitude and longitude (or leave both blank)." });
    return;
  }

  const lat = Number.parseFloat(latStr);
  const lng = Number.parseFloat(lngStr);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["gpsLat"], message: "Latitude must be a number between -90 and 90." });
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["gpsLng"], message: "Longitude must be a number between -180 and 180." });
  }
});

type Values = z.infer<typeof schema>;

export default function EditSiteDialog({ siteId, trigger }: { siteId: string; trigger?: React.ReactNode }) {
  const { data, actions } = useDashboardData();
  const site = data.sites.find((s) => s.id === siteId) as any;
  const [open, setOpen] = React.useState(false);
  const [scopeTemplate, setScopeTemplate] = React.useState<ScopeTemplateV1 | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      customerId: NONE,
      code: "",
      billingReference: "",
      address: "",
      gpsLat: "",
      gpsLng: "",
      scopeOfWork: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      notes: "",
    },
    mode: "onTouched",
  });

  const gpsLatStr = form.watch("gpsLat");
  const gpsLngStr = form.watch("gpsLng");
  const initialGps =
    gpsLatStr && gpsLngStr && Number.isFinite(Number.parseFloat(gpsLatStr)) && Number.isFinite(Number.parseFloat(gpsLngStr))
      ? { lat: Number.parseFloat(gpsLatStr), lng: Number.parseFloat(gpsLngStr) }
      : null;

  React.useEffect(() => {
    if (!open || !site) return;
    form.reset({
      name: site.name ?? "",
      customerId: site.customer_id ?? NONE,
      code: site.code ?? "",
      billingReference: site.billing_reference ?? "",
      address: site.address ?? "",
      gpsLat: site.gps_lat != null ? String(site.gps_lat) : "",
      gpsLng: site.gps_lng != null ? String(site.gps_lng) : "",
      scopeOfWork: site.scope_of_work ?? "",
      contactName: site.contact_name ?? "",
      contactPhone: site.contact_phone ?? "",
      contactEmail: site.contact_email ?? "",
      notes: site.notes ?? "",
    });
    setScopeTemplate(parseScopeTemplateV1(site.scope_template) ?? null);
  }, [form, open, site]);

  if (!site) return null;

  React.useEffect(() => {
    if (open) return;
    setScopeTemplate(null);
  }, [open]);

  const submit = form.handleSubmit(async (values) => {
    const gpsLat = String(values.gpsLat ?? "").trim();
    const gpsLng = String(values.gpsLng ?? "").trim();
    const gpsLatNum = gpsLat ? Number.parseFloat(gpsLat) : null;
    const gpsLngNum = gpsLng ? Number.parseFloat(gpsLng) : null;

    const updated = await actions.updateSite(siteId, {
      name: values.name,
      customer_id: values.customerId && values.customerId !== NONE ? values.customerId : null,
      code: values.code || null,
      billing_reference: values.billingReference || null,
      address: values.address || null,
      gps_lat: typeof gpsLatNum === "number" && Number.isFinite(gpsLatNum) ? gpsLatNum : null,
      gps_lng: typeof gpsLngNum === "number" && Number.isFinite(gpsLngNum) ? gpsLngNum : null,
      scope_template: normalizeScopeTemplate(scopeTemplate),
      scope_of_work: values.scopeOfWork || null,
      contact_name: values.contactName || null,
      contact_phone: values.contactPhone || null,
      contact_email: values.contactEmail || null,
      notes: values.notes || null,
    } as any);
    if (!updated) return;
    toast({ title: "Site updated" });
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm" variant="outline">Edit</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit site</DialogTitle>
          <DialogDescription>Update site details, scope of work, and the billing/contact information.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={submit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Main office - DB board" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer (optional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="No customer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>No customer</SelectItem>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site code (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. DB-01 / ROOF-A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="billingReference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing reference (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. PO #1234 / Quote #A-22" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Street, city" autoComplete="street-address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gpsLat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GPS latitude (optional)</FormLabel>
                    <FormControl>
                      <Input type="number" inputMode="decimal" step="any" placeholder="-26.2041" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gpsLng"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GPS longitude (optional)</FormLabel>
                    <FormControl>
                      <Input type="number" inputMode="decimal" step="any" placeholder="28.0473" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 -mt-2">
              <div className="text-xs text-muted-foreground">
                If you don’t know the exact GPS coords, use the map picker.
              </div>
              <LatLngPickerDialog
                initialQuery={(form.watch("address") || form.watch("name") || "").trim() || undefined}
                initialCenter={initialGps}
                onConfirm={({ lat, lng }) => {
                  form.setValue("gpsLat", lat.toFixed(6), { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                  form.setValue("gpsLng", lng.toFixed(6), { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                }}
                trigger={(
                  <Button type="button" size="sm" variant="outline" className="gap-1.5 w-full sm:w-auto">
                    <MapPin className="h-4 w-4" />
                    Pick on map
                  </Button>
                )}
              />
            </div>
            <div className="text-xs text-muted-foreground -mt-2">
              If provided, admin can see technician distance + arrival detection for this site.
            </div>

            <FormField
              control={form.control}
              name="scopeOfWork"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scope of work (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="What is being done on this site?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <ScopeTemplateBuilder value={scopeTemplate} onChange={setScopeTemplate} />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site contact</FormLabel>
                    <FormControl>
                      <Input placeholder="Name" autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+27 ..." autoComplete="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="contact@customer.com" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Access details, constraints, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" className="gradient-bg hover:opacity-90 shadow-glow" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
