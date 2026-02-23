import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { formatZarFromCents } from "@/lib/money";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import * as React from "react";

function parseMoneyToCents(value: string) {
  const v = value.trim();
  if (!v) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return NaN;
  return Math.round(Number.parseFloat(v) * 100);
}

export default function EditInventoryCostDialog({ itemId, trigger }: { itemId: string; trigger?: React.ReactNode }) {
  const { data, actions } = useDashboardData();
  const item: any = data.inventoryItems.find((i) => i.id === itemId) ?? null;

  const [open, setOpen] = React.useState(false);
  const [unitCost, setUnitCost] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open || !item) return;
    setUnitCost(typeof item.unit_cost_cents === "number" ? (item.unit_cost_cents / 100).toFixed(2) : "");
  }, [item, open]);

  if (!item) return null;

  const save = async () => {
    const unitCostCents = parseMoneyToCents(unitCost);
    if (Number.isNaN(unitCostCents)) {
      toast({ title: "Invalid amount", description: "Use numbers like 12 or 12.34.", variant: "destructive" });
      return;
    }
    setSaving(true);
    await actions.setInventoryUnitCost(itemId, unitCostCents);
    setSaving(false);
    toast({ title: "Unit cost saved" });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm" variant="outline">Cost</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unit cost</DialogTitle>
          <DialogDescription>Used for material cost and wastage reporting.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-sm font-medium">{item.name}</div>
          <div className="text-xs text-muted-foreground">
            Current: {typeof item.unit_cost_cents === "number" ? formatZarFromCents(item.unit_cost_cents) : "—"} per {item.unit}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Unit cost (R)</Label>
          <Input inputMode="decimal" placeholder="e.g. 2.50" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving} className="gradient-bg hover:opacity-90 shadow-glow">
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
