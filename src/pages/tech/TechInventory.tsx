import { useAuth } from "@/features/auth/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Boxes } from "lucide-react";
import * as React from "react";

export default function TechInventory() {
  const { profile } = useAuth();
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!profile?.company_id) return;
    supabase
      .from("inventory_items")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("name")
      .then(({ data }) => {
        setItems(data ?? []);
        setLoading(false);
      });
  }, [profile?.company_id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventory</h1>
        <p className="text-muted-foreground text-sm">View available stock and materials.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Boxes className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <div className="font-medium">No inventory items</div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 sm:hidden">
            {items.map((item) => (
              <Card key={item.id} className="bg-card/70 backdrop-blur-sm">
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{item.sku ? `SKU: ${item.sku}` : "No SKU"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold leading-none">{item.quantity_on_hand}</div>
                      <div className="text-xs text-muted-foreground">{item.unit}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Location: {item.location ?? "—"}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.sku ?? "—"}</TableCell>
                    <TableCell className="text-right">{item.quantity_on_hand}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-muted-foreground">{item.location ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
