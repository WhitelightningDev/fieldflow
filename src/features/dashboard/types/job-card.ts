import type { TradeId } from "@/features/company-signup/content/trades";
import type { EntityId, ISODateTimeString } from "@/features/dashboard/types/common";

export type JobCardStatus = "new" | "scheduled" | "in-progress" | "completed" | "invoiced" | "cancelled";

export type JobCard = {
  id: EntityId;
  tradeId: TradeId;
  title: string;
  description?: string;
  status: JobCardStatus;
  customerId: EntityId;
  technicianId?: EntityId;
  scheduledAt?: ISODateTimeString;
  checklist: string[];
  notes?: string;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
};

