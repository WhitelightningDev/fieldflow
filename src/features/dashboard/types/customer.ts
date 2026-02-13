import type { EntityId } from "@/features/dashboard/types/common";

export type Customer = {
  id: EntityId;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
};

