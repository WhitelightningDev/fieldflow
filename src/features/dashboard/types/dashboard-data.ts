import type { Customer } from "@/features/dashboard/types/customer";
import type { InventoryItem } from "@/features/dashboard/types/inventory";
import type { JobCard } from "@/features/dashboard/types/job-card";
import type { Technician } from "@/features/dashboard/types/technician";

export type DashboardData = {
  customers: Customer[];
  technicians: Technician[];
  jobCards: JobCard[];
  inventoryItems: InventoryItem[];
};

