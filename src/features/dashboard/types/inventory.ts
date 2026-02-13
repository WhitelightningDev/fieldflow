import type { TradeId } from "@/features/company-signup/content/trades";
import type { EntityId, ISODateTimeString } from "@/features/dashboard/types/common";

export type InventoryUnit = "each" | "meter" | "liter" | "kg" | "box";

export type InventoryItem = {
  id: EntityId;
  tradeId: TradeId;
  name: string;
  sku?: string;
  unit: InventoryUnit;
  quantityOnHand: number;
  reorderPoint: number;
  perishable: boolean;
  expiryDate?: ISODateTimeString;
  location?: string;
  createdAt: ISODateTimeString;
};

