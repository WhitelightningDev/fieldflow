import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { zodResolver } from "@hookform/resolvers/zod";
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
  scopeOfWork: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
  notes: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export default function EditSiteDialog({ siteId }: { siteId: string }) {
  const { data, actions } = useDashboardData();
  const site = data.sites.find((s) => s.id === siteId) as any;
  const [open, setOpen] = React.useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      customerId: NONE,
      code: "",
      billingReference: "",
      address: "",
      scopeOfWork: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      notes: "",
    },
    mode: "onTouched",
  });

  React.useEffect(() => {
    if (!open || !site) return;
    form.reset({
      name: site.name ?? "",
      customerId: site.customer_id ?? NONE,
      code: site.code ?? "",
      billingReference: site.billing_reference ?? "",
      address: site.address ?? "",
      scopeOfWork: site.scope_of_work ?? "",
      contactName: site.contact_name ?? "",
      contactPhone: site.contact_phone ?? "",
      contactEmail: site.contact_email ?? "",
      notes: site.notes ?? "",
    });
  }, [form, open, site]);

  if (!site) return null;

  const submit = form.handleSubmit(async (values) => {
    const updated = await actions.updateSite(siteId, {
      name: values.name,
      customer_id: values.customerId && values.customerId !== NONE ? values.customerId : null,
      code: values.code || null,
      billing_reference: values.billingReference || null,
      address: values.address || null,
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
        <Button size="sm" variant="outline">Edit</Button>
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

