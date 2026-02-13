import type { TradeId } from "@/features/company-signup/content/trades";
import type { Database } from "@/integrations/supabase/types";

type InventoryUnit = Database["public"]["Enums"]["inventory_unit"];

type InventoryTemplate = {
  tradeId: TradeId;
  name: string;
  unit: InventoryUnit;
  sku?: string;
  location?: string;
  reorderPoint: number;
  perishable: boolean;
  defaultQuantityOnHand: number;
};

function template(args: {
  tradeId: TradeId;
  name: string;
  unit: InventoryUnit;
  reorderPoint: number;
  perishable?: boolean;
  sku?: string;
  location?: string;
}): InventoryTemplate {
  return {
    tradeId: args.tradeId,
    name: args.name,
    unit: args.unit,
    sku: args.sku,
    location: args.location,
    reorderPoint: args.reorderPoint,
    perishable: args.perishable ?? false,
    defaultQuantityOnHand: Math.max(args.reorderPoint * 2, 1),
  };
}

export const INVENTORY_TEMPLATES_BY_TRADE: Record<TradeId, InventoryTemplate[]> = {
  "electrical-contracting": [
    template({ tradeId: "electrical-contracting", name: "Twin & Earth cable (2.5mm)", unit: "meter", reorderPoint: 50 }),
    template({ tradeId: "electrical-contracting", name: "Circuit breakers (assorted)", unit: "each", reorderPoint: 10 }),
    template({ tradeId: "electrical-contracting", name: "Junction boxes", unit: "each", reorderPoint: 10 }),
    template({ tradeId: "electrical-contracting", name: "Cable ties (pack)", unit: "box", reorderPoint: 3 }),
  ],
  plumbing: [
    template({ tradeId: "plumbing", name: "PVC pipe (assorted)", unit: "meter", reorderPoint: 30 }),
    template({ tradeId: "plumbing", name: "Compression fittings (assorted)", unit: "each", reorderPoint: 20 }),
    template({ tradeId: "plumbing", name: "PTFE tape", unit: "each", reorderPoint: 10 }),
    template({ tradeId: "plumbing", name: "Sealant / silicone", unit: "each", reorderPoint: 6, perishable: true }),
  ],
  "mobile-mechanics": [
    template({ tradeId: "mobile-mechanics", name: "Engine oil (5L)", unit: "liter", reorderPoint: 20, perishable: true }),
    template({ tradeId: "mobile-mechanics", name: "Oil filters", unit: "each", reorderPoint: 10 }),
    template({ tradeId: "mobile-mechanics", name: "Air filters", unit: "each", reorderPoint: 10 }),
    template({ tradeId: "mobile-mechanics", name: "Brake cleaner", unit: "liter", reorderPoint: 6, perishable: true }),
  ],
  refrigeration: [
    template({ tradeId: "refrigeration", name: "Refrigerant (cylinder)", unit: "each", reorderPoint: 2, perishable: true }),
    template({ tradeId: "refrigeration", name: "Service valves", unit: "each", reorderPoint: 6 }),
    template({ tradeId: "refrigeration", name: "Capacitors", unit: "each", reorderPoint: 10 }),
    template({ tradeId: "refrigeration", name: "Insulation tape", unit: "each", reorderPoint: 8, perishable: true }),
  ],
  "appliance-repair": [
    template({ tradeId: "appliance-repair", name: "Fuses (assorted)", unit: "each", reorderPoint: 20 }),
    template({ tradeId: "appliance-repair", name: "Belts (assorted)", unit: "each", reorderPoint: 6 }),
    template({ tradeId: "appliance-repair", name: "Drain pumps", unit: "each", reorderPoint: 3 }),
    template({ tradeId: "appliance-repair", name: "Cleaning/descaling solution", unit: "liter", reorderPoint: 6, perishable: true }),
  ],
};
