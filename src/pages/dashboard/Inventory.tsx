import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isTradeId, type TradeId, TRADES } from "@/features/company-signup/content/trades";
import AdjustInventoryDialog from "@/features/dashboard/components/dialogs/adjust-inventory-dialog";
import CreateInventoryItemDialog from "@/features/dashboard/components/dialogs/create-inventory-item-dialog";
import EditInventoryCostDialog from "@/features/dashboard/components/dialogs/edit-inventory-cost-dialog";
import PageHeader from "@/features/dashboard/components/page-header";
import { INVENTORY_TEMPLATES_BY_TRADE } from "@/features/dashboard/constants/inventory-templates";
import { useDashboardSelectors } from "@/features/dashboard/hooks/use-dashboard-selectors";
import { useInventoryAlerts } from "@/features/dashboard/hooks/use-inventory-alerts";
import { useTradeFilter } from "@/features/dashboard/hooks/use-trade-filter";
import { getInventoryRecommendations } from "@/features/dashboard/lib/inventory-recommendations";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import type { Tables } from "@/integrations/supabase/types";
import { formatZarFromCents } from "@/lib/money";
import { toast } from "@/components/ui/use-toast";
import { AlertTriangle } from "lucide-react";
import * as React from "react";
import { format } from "date-fns";
import RowActionsMenu from "@/components/row-actions-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export default function Inventory() {
  const { data, actions } = useDashboardData();
  const allowedTradeIds: TradeId[] | null = data.company?.industry && isTradeId(data.company.industry) ? [data.company.industry] : null;
  const { trade } = useTradeFilter(allowedTradeIds);
  const selectors = useDashboardSelectors(data, trade);
  const { lowStock, expiringSoon } = useInventoryAlerts(selectors.inventoryItems);

  const [adjustOpen, setAdjustOpen] = React.useState(false);
  const [adjustItemId, setAdjustItemId] = React.useState<string | null>(null);
  const adjustItem = selectors.inventoryItems.find((i) => i.id === adjustItemId) ?? null;
  const [addingSmart, setAddingSmart] = React.useState<string | null>(null);

  const canAddTemplates = trade !== "all";
  const tradeId = trade === "all" ? null : trade;

  const lastAddedName = selectors.inventoryItems[0]?.name ?? "";
  const smartAddOns = React.useMemo(() => {
    if (!tradeId) return [];
    return getInventoryRecommendations({
      tradeId,
      itemName: lastAddedName,
      existingItems: selectors.inventoryItems,
      max: 4,
    });
  }, [lastAddedName, selectors.inventoryItems, tradeId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        subtitle="Track trade-specific stock (including perishables) and get low-stock warnings."
        actions={
          <div className="flex items-center gap-2">
            <CreateInventoryItemDialog tradeFilter={trade} allowedTradeIds={allowedTradeIds} />
          </div>
        }
      />

      {(lowStock.length > 0 || expiringSoon.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {lowStock.length > 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Low stock</AlertTitle>
              <AlertDescription>
                {lowStock.slice(0, 6).map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{i.name}</span>
                    <Badge variant="outline">
                      {i.quantity_on_hand}/{i.reorder_point} {i.unit}
                    </Badge>
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          ) : null}
          {expiringSoon.length > 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Perishables expiring soon</AlertTitle>
              <AlertDescription>
                {expiringSoon.slice(0, 6).map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{i.name}</span>
                    <Badge variant="secondary">{i.expiry_date ? format(new Date(i.expiry_date), "PP") : "Perishable"}</Badge>
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      )}

      {!canAddTemplates ? (
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Trade templates</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Select a specific trade in the top bar to view recommended inventory templates for that industry.
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recommended for {TRADES.find((t) => t.id === trade)?.shortName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {INVENTORY_TEMPLATES_BY_TRADE[trade].map((t) => (
                <Badge key={t.name} variant={t.perishable ? "default" : "secondary"} className="gap-1.5">
                  {t.name}
                  {t.perishable ? <span className="opacity-80">(perishable)</span> : null}
                </Badge>
              ))}
            </div>

            {tradeId === "electrical-contracting" && smartAddOns.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">AI add-ons</div>
                  {lastAddedName ? <div className="text-xs text-muted-foreground truncate">Based on: {lastAddedName}</div> : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {smartAddOns.map((r) => (
                    <div key={r.name} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.reason}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={addingSmart === r.name}
                        onClick={async () => {
                          if (!tradeId) return;
                          setAddingSmart(r.name);
                          try {
                            const row = await actions.addInventoryItem({
                              trade_id: tradeId,
                              name: r.name,
                              sku: r.sku ?? null,
                              unit: r.unit,
                              unit_cost_cents: 0,
                              quantity_on_hand: 0,
                              reorder_point: r.reorderPoint,
                              perishable: r.perishable,
                              expiry_date: null,
                              location: r.location ?? null,
                            });
                            if (row) toast({ title: "Added recommended item", description: r.name });
                          } finally {
                            setAddingSmart(null);
                          }
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Trade</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Unit cost</TableHead>
              <TableHead>Reorder at</TableHead>
              <TableHead>Perishable</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead className="w-[160px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {selectors.inventoryItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  No inventory items yet for this trade filter.
                </TableCell>
              </TableRow>
            ) : null}
            {selectors.inventoryItems.map((i) => {
              const isLow = i.quantity_on_hand <= i.reorder_point;
              return (
                <TableRow key={i.id}>
                  <TableCell>
                    <div className="font-medium flex items-center gap-2">
                      {i.name}
                      {isLow ? <Badge variant="destructive">Low</Badge> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">{i.sku ? `SKU: ${i.sku}` : "—"}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {TRADES.find((t) => t.id === i.trade_id)?.shortName ?? i.trade_id}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{i.quantity_on_hand}</span>{" "}
                    <span className="text-sm text-muted-foreground">{i.unit}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {typeof (i as any).unit_cost_cents === "number" ? formatZarFromCents((i as any).unit_cost_cents) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{i.reorder_point}</TableCell>
                  <TableCell>{i.perishable ? <Badge>Yes</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {i.expiry_date ? format(new Date(i.expiry_date), "PP") : "—"}
                  </TableCell>
                  <TableCell>
                    <RowActionsMenu label="Inventory actions">
                      <EditInventoryCostDialog itemId={i.id} trigger={<DropdownMenuItem>Unit cost</DropdownMenuItem>} />
                      <DropdownMenuItem
                        onSelect={() => {
                          setAdjustItemId(i.id);
                          setAdjustOpen(true);
                        }}
                      >
                        Adjust quantity
                      </DropdownMenuItem>
                    </RowActionsMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AdjustInventoryDialog item={adjustItem} open={adjustOpen} onOpenChange={setAdjustOpen} />
    </div>
  );
}
