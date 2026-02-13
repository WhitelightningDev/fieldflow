import type { TradeId } from "@/features/company-signup/content/trades";
import type { EntityId } from "@/features/dashboard/types/common";

export type Technician = {
  id: EntityId;
  name: string;
  phone?: string;
  email?: string;
  trades: TradeId[];
  active: boolean;
  createdAt: string;
};

