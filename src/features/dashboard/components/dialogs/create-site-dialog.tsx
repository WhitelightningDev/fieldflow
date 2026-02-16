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

const schema = z.object({
  name: z.string().min(2, "Site name is required"),
  customerId: z.string().optional(),
  code: z.string().optional(),
  billingReference: z.string().optional(),
  address: z.string().optional(),
  scopeOfWork: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  notes: z.string().optional(),
});

type Values = z.infer<typeof schema>;

const NONE = "__none__";

export default function CreateSiteDialog() {
  const { data, actions } = useDashboardData();
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

  const submit = form.handleSubmit(async (values) => {
    const created = await actions.addSite({
      name: values.name,
      customer_id: values.customerId && values.customerId !== NONE ? values.customerId : null,
      code: values.code ? values.code : null,
      address: values.address || null,
      notes: values.notes || null,
    } as any);
    if (!created) return;
    toast({ title: "Site created" });
    setOpen(false);
    form.reset({
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
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          Create site
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create site</DialogTitle>
          <DialogDescription>
            Capture enough detail to run the site: scope of work, invoicing reference, and who to contact.
          </DialogDescription>
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
                    <Input placeholder="Street, City" {...field} />
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
                    <Textarea
                      rows={4}
                      placeholder="What is being done on this site? e.g. Solar install, DB board upgrade, panel allocation, compliance checklist..."
                      {...field}
                    />
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
                      <Input placeholder="email@site.com" autoComplete="email" {...field} />
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
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" className="gradient-bg hover:opacity-90 shadow-glow">
                Create site
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
