import type { TradeFilter } from "@/features/dashboard/hooks/use-trade-filter";
import type { DashboardData } from "@/features/dashboard/types/dashboard-data";

export function useDashboardSelectors(data: DashboardData, trade: TradeFilter) {
  const customersById = new Map(data.customers.map((c) => [c.id, c]));
  const techniciansById = new Map(data.technicians.map((t) => [t.id, t]));

  const jobCards = trade === "all" ? data.jobCards : data.jobCards.filter((j) => j.tradeId === trade);
  const inventoryItems = trade === "all" ? data.inventoryItems : data.inventoryItems.filter((i) => i.tradeId === trade);

  return {
    customersById,
    techniciansById,
    jobCards,
    inventoryItems,
  };
}

