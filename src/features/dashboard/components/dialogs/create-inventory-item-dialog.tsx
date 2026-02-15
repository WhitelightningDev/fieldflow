import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { TRADES, type TradeId } from "@/features/company-signup/content/trades";
import type { TradeFilter } from "@/features/dashboard/hooks/use-trade-filter";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import type { Database } from "@/integrations/supabase/types";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

type InventoryUnit = Database["public"]["Enums"]["inventory_unit"];
const units: InventoryUnit[] = ["each", "meter", "liter", "kg", "box"];
const tradeIds = TRADES.map((t) => t.id) as [TradeId, ...TradeId[]];

const schema = z.object({
  tradeId: z.enum(tradeIds),
  name: z.string().min(2, "Item name is required"),
  sku: z.string().optional(),
  unit: z.enum(["each", "meter", "liter", "kg", "box"]),
  quantityOnHand: z.coerce.number().min(0),
  reorderPoint: z.coerce.number().min(0),
  perishable: z.boolean(),
  expiryDate: z.string().optional(),
  location: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export default function CreateInventoryItemDialog({
  tradeFilter,
  allowedTradeIds,
}: {
  tradeFilter: TradeFilter;
  allowedTradeIds?: readonly TradeId[] | null;
}) {
  const { actions } = useDashboardData();
  const [open, setOpen] = React.useState(false);

  const tradesForSelect = React.useMemo(() => {
    if (!allowedTradeIds || allowedTradeIds.length === 0) return TRADES;
    return TRADES.filter((t) => allowedTradeIds.includes(t.id));
  }, [allowedTradeIds]);

  const lockedTradeId = allowedTradeIds && allowedTradeIds.length === 1 ? allowedTradeIds[0] : null;
  const defaultTradeId: TradeId = lockedTradeId ?? (tradeFilter === "all" ? TRADES[0].id : tradeFilter);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      tradeId: defaultTradeId,
      name: "",
      sku: "",
      unit: "each",
      quantityOnHand: 0,
      reorderPoint: 5,
      perishable: false,
      expiryDate: "",
      location: "",
    },
    mode: "onTouched",
  });

  React.useEffect(() => {
    if (!open) return;
    const nextTradeId: TradeId = lockedTradeId ?? (tradeFilter === "all" ? TRADES[0].id : tradeFilter);
    form.setValue("tradeId", nextTradeId);
  }, [form, lockedTradeId, open, tradeFilter]);

  const submit = form.handleSubmit(async (values) => {
    await actions.addInventoryItem({
      trade_id: values.tradeId,
      name: values.name,
      sku: values.sku || null,
      unit: values.unit,
      quantity_on_hand: values.quantityOnHand,
      reorder_point: values.reorderPoint,
      perishable: values.perishable,
      expiry_date: values.perishable && values.expiryDate ? new Date(values.expiryDate).toISOString() : null,
      location: values.location || null,
    });
    toast({ title: "Inventory item added" });
    setOpen(false);
    form.reset({ ...form.getValues(), name: "", sku: "", quantityOnHand: 0, location: "" });
  });

  const perishable = form.watch("perishable");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add item</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add inventory item</DialogTitle>
          <DialogDescription>Track stock counts and get low-stock reminders.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={submit} className="space-y-4">
            <FormField
              control={form.control}
              name="tradeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trade</FormLabel>
                  {lockedTradeId ? (
                    <div className="h-10 px-3 rounded-md border flex items-center text-sm text-muted-foreground">
                      {TRADES.find((t) => t.id === lockedTradeId)?.name ?? lockedTradeId}
                    </div>
                  ) : (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. PTFE tape" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
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
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="SKU-123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantityOnHand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity on hand</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reorderPoint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Low-stock threshold</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Van 1 / Warehouse" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="perishable"
                render={({ field }) => (
                  <FormItem className="pt-8">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
                      <FormLabel className="m-0">Perishable item</FormLabel>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {perishable ? (
              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry date (optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <DialogFooter>
              <Button type="submit" className="gradient-bg hover:opacity-90 shadow-glow" disabled={form.formState.isSubmitting}>
                Add item
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
