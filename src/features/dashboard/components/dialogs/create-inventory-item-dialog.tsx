import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { TRADES, type TradeId } from "@/features/company-signup/content/trades";
import type { TradeFilter } from "@/features/dashboard/hooks/use-trade-filter";
import { getInventoryRecommendations, type InventoryRecommendation } from "@/features/dashboard/lib/inventory-recommendations";
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
  unitCost: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+(\.\d{1,2})?$/.test(v.trim()), "Enter amount like 2 or 2.50"),
  quantityOnHand: z.coerce.number().min(0),
  reorderPoint: z.coerce.number().min(0),
  perishable: z.boolean(),
  expiryDate: z.string().optional(),
  location: z.string().optional(),
});

type Values = z.infer<typeof schema>;

function moneyToCents(v?: string) {
  const s = (v ?? "").trim();
  if (!s) return null;
  return Math.round(Number.parseFloat(s) * 100);
}

export default function CreateInventoryItemDialog({
  tradeFilter,
  allowedTradeIds,
}: {
  tradeFilter: TradeFilter;
  allowedTradeIds?: readonly TradeId[] | null;
}) {
  const { data, actions } = useDashboardData();
  const [open, setOpen] = React.useState(false);
  const [addingRecommendation, setAddingRecommendation] = React.useState(false);

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
      unitCost: "",
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
      unit_cost_cents: moneyToCents(values.unitCost),
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
  const tradeId = form.watch("tradeId");
  const itemName = form.watch("name");

  const recommendations = React.useMemo(() => {
    return getInventoryRecommendations({
      tradeId,
      itemName,
      existingItems: data.inventoryItems,
      max: 6,
    });
  }, [data.inventoryItems, itemName, tradeId]);

  const addRecommendation = React.useCallback(
    async (r: InventoryRecommendation) => {
      setAddingRecommendation(true);
      try {
        const current = form.getValues();
        const dirty = form.formState.dirtyFields;
        const sku = (current.sku ?? "").trim() ? current.sku : (r.sku ?? "");
        const location = (current.location ?? "").trim() ? current.location : (r.location ?? "");
        const unit = dirty.unit ? current.unit : r.unit;
        const reorderPoint = dirty.reorderPoint ? current.reorderPoint : r.reorderPoint;
        const quantityOnHand = dirty.quantityOnHand ? current.quantityOnHand : 0;
        const unitCostCents = moneyToCents(current.unitCost);

        const row = await actions.addInventoryItem({
          trade_id: current.tradeId,
          name: r.name,
          sku: sku || null,
          unit,
          unit_cost_cents: unitCostCents,
          quantity_on_hand: quantityOnHand,
          reorder_point: reorderPoint,
          perishable: r.perishable,
          expiry_date: r.perishable && current.expiryDate ? new Date(current.expiryDate).toISOString() : null,
          location: location || null,
        });
        if (row) toast({ title: "Added recommended item", description: r.name });
      } finally {
        setAddingRecommendation(false);
      }
    },
    [actions, form],
  );

  const addAllRecommendations = React.useCallback(async () => {
    if (recommendations.length === 0) return;
    setAddingRecommendation(true);
    try {
      const current = form.getValues();
      const dirty = form.formState.dirtyFields;
      const baseSku = (current.sku ?? "").trim() ? current.sku : "";
      const baseLocation = (current.location ?? "").trim() ? current.location : "";
      const baseUnit = dirty.unit ? current.unit : null;
      const baseReorderPoint = dirty.reorderPoint ? current.reorderPoint : null;
      const baseQuantityOnHand = dirty.quantityOnHand ? current.quantityOnHand : 0;
      const baseUnitCostCents = moneyToCents(current.unitCost);
      const baseExpiryDate = current.expiryDate ? new Date(current.expiryDate).toISOString() : null;

      let added = 0;
      for (const r of recommendations) {
        const sku = baseSku || (r.sku ?? "");
        const location = baseLocation || (r.location ?? "");
        const unit = baseUnit ?? r.unit;
        const reorderPoint = baseReorderPoint ?? r.reorderPoint;

        const row = await actions.addInventoryItem({
          trade_id: current.tradeId,
          name: r.name,
          sku: sku || null,
          unit,
          unit_cost_cents: baseUnitCostCents,
          quantity_on_hand: baseQuantityOnHand,
          reorder_point: reorderPoint,
          perishable: r.perishable,
          expiry_date: r.perishable ? baseExpiryDate : null,
          location: location || null,
        });
        if (row) added += 1;
      }
      if (added > 0) toast({ title: "Added recommended items", description: `${added} item(s) added` });
    } finally {
      setAddingRecommendation(false);
    }
  }, [actions, form, recommendations]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add item</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
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

            {tradeId === "electrical-contracting" ? (
              <Card className="bg-card/70 backdrop-blur-sm">
                <CardHeader className="pb-3 flex-row items-start justify-between gap-4 space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="text-base">Recommended for Electrical</CardTitle>
                    <div className="text-xs text-muted-foreground">Smart add-ons based on what you’re adding.</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={addingRecommendation || recommendations.length === 0}
                    onClick={addAllRecommendations}
                  >
                    Add all
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recommendations.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No suggestions right now.</div>
                  ) : (
                    recommendations.map((r) => (
                      <div key={r.name} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{r.name}</div>
                          <div className="text-xs text-muted-foreground">{r.reason}</div>
                        </div>
                        <Button type="button" size="sm" variant="secondary" disabled={addingRecommendation} onClick={() => addRecommendation(r)}>
                          Add
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ) : null}

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

            <FormField
              control={form.control}
              name="unitCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit cost (R, optional)</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="e.g. 2.50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
