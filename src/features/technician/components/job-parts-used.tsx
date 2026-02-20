import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Package, Plus } from "lucide-react";
import * as React from "react";

type Props = {
  jobId: string;
  siteId: string | null;
  companyId: string;
  onPartsLogged?: () => void;
};

export default function JobPartsUsed({ jobId, siteId, companyId, onPartsLogged }: Props) {
  const [inventory, setInventory] = React.useState<any[]>([]);
  const [usedParts, setUsedParts] = React.useState<any[]>([]);
  const [selectedItem, setSelectedItem] = React.useState("");
  const [qty, setQty] = React.useState("1");
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    supabase
      .from("inventory_items")
      .select("id, name, unit, quantity_on_hand")
      .eq("company_id", companyId)
      .order("name")
      .then(({ data }) => setInventory(data ?? []));
  }, [companyId]);

  const fetchUsed = React.useCallback(async () => {
    if (!siteId) return;
    const { data } = await supabase
      .from("site_material_usage")
      .select("*, inventory_items(name, unit)")
      .eq("job_card_id", jobId)
      .order("used_at", { ascending: false });
    setUsedParts(data ?? []);
  }, [jobId, siteId]);

  React.useEffect(() => { fetchUsed(); }, [fetchUsed]);

  const addPart = async () => {
    if (!selectedItem || !siteId) {
      toast({ title: "Select a part and ensure job has a site", variant: "destructive" });
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("site_material_usage").insert({
      job_card_id: jobId,
      site_id: siteId,
      inventory_item_id: selectedItem,
      quantity_used: parseInt(qty) || 1,
    });
    setAdding(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    // Deduct from inventory
    const item = inventory.find((i) => i.id === selectedItem);
    if (item) {
      const newQty = Math.max(0, item.quantity_on_hand - (parseInt(qty) || 1));
      await supabase.from("inventory_items").update({ quantity_on_hand: newQty }).eq("id", selectedItem);
    }
    toast({ title: "Part logged" });
    setSelectedItem("");
    setQty("1");
    fetchUsed();
    onPartsLogged?.();
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Parts Used</h4>
      {!siteId ? (
        <p className="text-xs text-muted-foreground">Assign a site to this job to track parts.</p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <div className="flex-1">
              <Select value={selectedItem} onValueChange={setSelectedItem}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select part" />
                </SelectTrigger>
                <SelectContent>
                  {inventory.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.quantity_on_hand} {item.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full sm:w-20 h-9"
              placeholder="Qty"
            />
            <Button size="sm" onClick={addPart} disabled={adding} className="gap-1.5 w-full sm:w-auto">
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
          {usedParts.length > 0 && (
            <div className="space-y-1.5">
              {usedParts.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-md bg-secondary/50">
                  <span className="flex items-center gap-2 min-w-0">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{p.inventory_items?.name ?? "Unknown"}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {p.quantity_used} {p.inventory_items?.unit ?? ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
