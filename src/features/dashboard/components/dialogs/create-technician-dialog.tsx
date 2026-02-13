import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { TRADES, type TradeId } from "@/features/company-signup/content/trades";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const tradeIds = TRADES.map((t) => t.id) as [TradeId, ...TradeId[]];

const schema = z.object({
  name: z.string().min(2, "Technician name is required"),
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  active: z.boolean().default(true),
  trades: z.array(z.enum(tradeIds)).min(1, "Select at least one trade"),
});

type Values = z.infer<typeof schema>;

export default function CreateTechnicianDialog() {
  const { actions } = useDashboardData();
  const [open, setOpen] = React.useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", active: true, trades: [TRADES[0].id] },
    mode: "onTouched",
  });

  const submit = form.handleSubmit((values) => {
    actions.addTechnician({
      name: values.name,
      phone: values.phone || undefined,
      email: values.email || undefined,
      active: values.active,
      trades: values.trades,
    });
    toast({ title: "Technician added" });
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
          <DialogDescription>Assign one or more trades to the technician.</DialogDescription>
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="tech@company.com" autoComplete="email" {...field} />
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
                Add technician
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
