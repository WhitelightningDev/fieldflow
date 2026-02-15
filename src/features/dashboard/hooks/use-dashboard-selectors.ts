import type { TradeFilter } from "@/features/dashboard/hooks/use-trade-filter";
import type { DashboardData } from "@/features/dashboard/store/dashboard-data-store";

export function useDashboardSelectors(data: DashboardData, trade: TradeFilter) {
  const customersById = new Map(data.customers.map((c) => [c.id, c]));
  const techniciansById = new Map(data.technicians.map((t) => [t.id, t]));
  const sitesById = new Map(data.sites.map((s) => [s.id, s]));

  const jobCards = trade === "all" ? data.jobCards : data.jobCards.filter((j) => j.trade_id === trade);
  const inventoryItems = trade === "all" ? data.inventoryItems : data.inventoryItems.filter((i) => i.trade_id === trade);

  return {
    customersById,
    techniciansById,
    sitesById,
    jobCards,
    inventoryItems,
  };
}
