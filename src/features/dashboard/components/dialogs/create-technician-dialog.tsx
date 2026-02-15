import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { TRADES, type TradeId } from "@/features/company-signup/content/trades";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const tradeIds = TRADES.map((t) => t.id) as [TradeId, ...TradeId[]];

const schema = z.object({
  name: z.string().min(2, "Technician name is required"),
  phone: z.string().optional(),
  email: z.string().email("Email is required to send the invite"),
  hourlyCost: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+(\.\d{1,2})?$/.test(v.trim()), "Enter amount like 35 or 35.50"),
  hourlyBillRate: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+(\.\d{1,2})?$/.test(v.trim()), "Enter amount like 95 or 95.50"),
  active: z.boolean().default(true),
  trades: z.array(z.enum(tradeIds)).min(1, "Select at least one trade"),
});

type Values = z.infer<typeof schema>;

function moneyToCents(v?: string) {
  const s = (v ?? "").trim();
  if (!s) return null;
  return Math.round(Number.parseFloat(s) * 100);
}

export default function CreateTechnicianDialog() {
  const { actions, data } = useDashboardData();
  const { profile } = useAuth();
  const [open, setOpen] = React.useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", hourlyCost: "", hourlyBillRate: "", active: true, trades: [TRADES[0].id] },
    mode: "onTouched",
  });

  const submit = form.handleSubmit(async (values) => {
    // 1. Create technician record
    const tech = await actions.addTechnician({
      name: values.name,
      phone: values.phone || null,
      email: values.email || null,
      hourly_cost_cents: moneyToCents(values.hourlyCost),
      hourly_bill_rate_cents: moneyToCents(values.hourlyBillRate),
      active: values.active,
      trades: values.trades,
    });

    if (!tech) return;

    // 2. Send invite email via edge function
    if (values.email && profile?.company_id) {
      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke("invite-technician", {
          body: {
            technicianId: tech.id,
            email: values.email,
            name: values.name,
            companyId: profile.company_id,
            industry: data.company?.industry,
            redirectTo: `${getPublicSiteUrl()}/auth/callback`,
          },
        });
        if (fnError) {
          toast({ title: "Technician added", description: `Invite email failed: ${fnError.message}. You can resend later.` });
        } else {
          toast({ title: "Technician added & invited", description: `Invite email sent to ${values.email}` });
        }
      } catch {
        toast({ title: "Technician added", description: "Invite email could not be sent. You can resend later." });
      }
    } else {
      toast({ title: "Technician added" });
    }

    setOpen(false);
    form.reset();
  });

  const selectedTrades = form.watch("trades");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add technician</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add technician</DialogTitle>
          <DialogDescription>Add a technician and send them an invite email to log in.</DialogDescription>
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
                    <Input placeholder="e.g. Jordan" autoComplete="name" {...field} />
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
                    <FormLabel>Email (invite will be sent)</FormLabel>
                    <FormControl>
                      <Input placeholder="tech@company.com" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="hourlyCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hourly cost (USD, optional)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="e.g. 35.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hourlyBillRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hourly bill rate (USD, optional)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="e.g. 95.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Trades</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TRADES.map((t) => {
                  const checked = selectedTrades.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-left hover:bg-secondary/50 transition-colors"
                      onClick={() => {
                        const next = checked ? selectedTrades.filter((x) => x !== t.id) : [...selectedTrades, t.id];
                        form.setValue("trades", next, { shouldValidate: true, shouldDirty: true });
                      }}
                    >
                      <Checkbox checked={checked} />
                      <span className="text-sm">{t.name}</span>
                    </button>
                  );
                })}
              </div>
              <FormField control={form.control} name="trades" render={() => <FormMessage />} />
            </div>

            <DialogFooter>
              <Button type="submit" className="gradient-bg hover:opacity-90 shadow-glow" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Adding & inviting..." : "Add & invite technician"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
