import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2, "Customer name is required"),
  code: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  billingPhone: z.string().optional(),
  billingEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
  billingReference: z.string().optional(),
  vatNumber: z.string().optional(),
  paymentTerms: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export default function CreateCustomerDialog() {
  const { actions } = useDashboardData();
  const [open, setOpen] = React.useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      code: "",
      phone: "",
      email: "",
      billingPhone: "",
      billingEmail: "",
      billingReference: "",
      vatNumber: "",
      paymentTerms: "",
      address: "",
      notes: "",
    },
    mode: "onTouched",
  });

  const submit = form.handleSubmit(async (values) => {
    const row = await actions.addCustomer({
      name: values.name,
      phone: values.phone || null,
      email: values.email || null,
      address: values.address || null,
      notes: values.notes || null,
    } as any);
    if (!row) return;
    toast({ title: "Customer added" });
    setOpen(false);
    form.reset();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gradient-bg hover:opacity-90 shadow-glow">
          Add customer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add customer</DialogTitle>
          <DialogDescription>
            Capture enough detail to invoice cleanly (VAT, payment terms, and billing contact).
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={submit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Acme Properties" autoComplete="organization" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer code (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. ACME-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (primary)</FormLabel>
                    <FormControl>
                      <Input placeholder="billing@company.com" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-xl border bg-card/70 backdrop-blur-sm p-4 space-y-4">
              <div className="text-sm font-medium">Billing details</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="billingPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing phone (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="+27 ..." autoComplete="tel" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="billingEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing email (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="accounts@company.com" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vatNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VAT number (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 4123456789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment terms (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. EFT 30 days" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                  <FormLabel>Billing address (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Street, city" autoComplete="street-address" {...field} />
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Access codes, preferences, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" className="gradient-bg hover:opacity-90 shadow-glow" disabled={form.formState.isSubmitting}>
                Add customer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
