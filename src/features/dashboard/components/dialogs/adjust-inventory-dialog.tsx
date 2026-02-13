import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import type { Tables } from "@/integrations/supabase/types";
import * as React from "react";

type InventoryItem = Tables<"inventory_items">;

type Props = {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function AdjustInventoryDialog({ item, open, onOpenChange }: Props) {
  const { actions } = useDashboardData();
  const [delta, setDelta] = React.useState(0);

  React.useEffect(() => {
    if (!open) setDelta(0);
  }, [open]);

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {item.name} — currently {item.quantity_on_hand} {item.unit}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-sm font-medium">Adjustment</div>
          <Input
            type="number"
            step={1}
            value={delta}
            onChange={(e) => setDelta(Number(e.target.value))}
            placeholder="e.g. -2 or 10"
          />
          <div className="text-xs text-muted-foreground">Use negative numbers for stock-out, positive for stock-in.</div>
        </div>

        <DialogFooter>
          <Button
            onClick={async () => {
              await actions.adjustInventory(item.id, delta);
              toast({ title: "Stock updated" });
              onOpenChange(false);
            }}
            className="gradient-bg hover:opacity-90 shadow-glow"
            disabled={!Number.isFinite(delta) || delta === 0}
          >
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
