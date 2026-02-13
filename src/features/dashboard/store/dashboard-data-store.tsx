import * as React from "react";
import type { TradeId } from "@/features/company-signup/content/trades";
import { TRADES } from "@/features/company-signup/content/trades";
import { INVENTORY_TEMPLATES_BY_TRADE } from "@/features/dashboard/constants/inventory-templates";
import { TRADE_JOB_CHECKLISTS } from "@/features/dashboard/constants/job-checklists";
import { nowIso } from "@/features/dashboard/lib/clock";
import { createId } from "@/features/dashboard/lib/id";
import { readJson, writeJson } from "@/features/dashboard/lib/storage";
import type { Customer } from "@/features/dashboard/types/customer";
import type { DashboardData } from "@/features/dashboard/types/dashboard-data";
import type { InventoryItem } from "@/features/dashboard/types/inventory";
import type { JobCard, JobCardStatus } from "@/features/dashboard/types/job-card";
import type { Technician } from "@/features/dashboard/types/technician";

const STORAGE_KEY = "fieldflow.dashboard.v1";

type DashboardActions = {
  addCustomer: (customer: Omit<Customer, "id" | "createdAt">) => Customer;
  addTechnician: (technician: Omit<Technician, "id" | "createdAt">) => Technician;
  addJobCard: (jobCard: Omit<JobCard, "id" | "createdAt" | "updatedAt">) => JobCard;
  setJobCardStatus: (jobCardId: string, status: JobCardStatus) => void;
  addInventoryItem: (item: Omit<InventoryItem, "id" | "createdAt">) => InventoryItem;
  adjustInventory: (itemId: string, delta: number) => void;
  addInventoryTemplatesForTrade: (tradeId: TradeId) => void;
};

type DashboardStore = {
  data: DashboardData;
  actions: DashboardActions;
};

const DashboardDataContext = React.createContext<DashboardStore | null>(null);

function seed(): DashboardData {
  const createdAt = nowIso();
  const customers: Customer[] = [
    { id: createId("cus"), name: "Acme Properties", phone: "+27 11 555 0101", address: "Johannesburg", createdAt },
    { id: createId("cus"), name: "Sunrise Retail", phone: "+27 21 555 0199", address: "Cape Town", createdAt },
  ];

  const technicians: Technician[] = [
    {
      id: createId("tech"),
      name: "Jordan Mokoena",
      phone: "+27 72 555 0110",
      trades: TRADES.map((t) => t.id).slice(0, 2) as TradeId[],
      active: true,
      createdAt,
    },
  ];

  const firstTrade = TRADES[0].id;
  const jobCards: JobCard[] = [
    {
      id: createId("job"),
      tradeId: firstTrade,
      title: "Site call-out",
      description: "Initial assessment and quote",
      status: "scheduled",
      customerId: customers[0].id,
      technicianId: technicians[0].id,
      scheduledAt: createdAt,
      checklist: TRADE_JOB_CHECKLISTS[firstTrade],
      notes: "",
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const inventoryItems: InventoryItem[] = Object.entries(INVENTORY_TEMPLATES_BY_TRADE).flatMap(([tradeId, templates]) => {
    return templates.slice(0, 2).map((t) => ({
      id: createId("inv"),
      tradeId: tradeId as TradeId,
      name: t.name,
      sku: t.sku,
      unit: t.unit,
      quantityOnHand: t.defaultQuantityOnHand,
      reorderPoint: t.reorderPoint,
      perishable: t.perishable,
      expiryDate: undefined,
      location: t.location,
      createdAt,
    }));
  });

  return { customers, technicians, jobCards, inventoryItems };
}

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState<DashboardData>(() => readJson<DashboardData>(STORAGE_KEY) ?? seed());

  React.useEffect(() => {
    writeJson(STORAGE_KEY, data);
  }, [data]);

  const actions = React.useMemo<DashboardActions>(() => {
    return {
      addCustomer: (customer) => {
        const next: Customer = { id: createId("cus"), createdAt: nowIso(), ...customer };
        setData((prev) => ({ ...prev, customers: [next, ...prev.customers] }));
        return next;
      },
      addTechnician: (technician) => {
        const next: Technician = { id: createId("tech"), createdAt: nowIso(), ...technician };
        setData((prev) => ({ ...prev, technicians: [next, ...prev.technicians] }));
        return next;
      },
      addJobCard: (jobCard) => {
        const ts = nowIso();
        const next: JobCard = { id: createId("job"), createdAt: ts, updatedAt: ts, ...jobCard };
        setData((prev) => ({ ...prev, jobCards: [next, ...prev.jobCards] }));
        return next;
      },
      setJobCardStatus: (jobCardId, status) => {
        setData((prev) => ({
          ...prev,
          jobCards: prev.jobCards.map((j) => (j.id === jobCardId ? { ...j, status, updatedAt: nowIso() } : j)),
        }));
      },
      addInventoryItem: (item) => {
        const next: InventoryItem = { id: createId("inv"), createdAt: nowIso(), ...item };
        setData((prev) => ({ ...prev, inventoryItems: [next, ...prev.inventoryItems] }));
        return next;
      },
      adjustInventory: (itemId, delta) => {
        setData((prev) => ({
          ...prev,
          inventoryItems: prev.inventoryItems.map((i) =>
            i.id === itemId ? { ...i, quantityOnHand: Math.max(0, i.quantityOnHand + delta) } : i,
          ),
        }));
      },
      addInventoryTemplatesForTrade: (tradeId) => {
        const templates = INVENTORY_TEMPLATES_BY_TRADE[tradeId];
        const createdAt = nowIso();
        setData((prev) => {
          const existingNames = new Set(prev.inventoryItems.filter((i) => i.tradeId === tradeId).map((i) => i.name.toLowerCase()));
          const toAdd: InventoryItem[] = templates
            .filter((t) => !existingNames.has(t.name.toLowerCase()))
            .map((t) => ({
              id: createId("inv"),
              tradeId,
              name: t.name,
              sku: t.sku,
              unit: t.unit,
              quantityOnHand: t.defaultQuantityOnHand,
              reorderPoint: t.reorderPoint,
              perishable: t.perishable,
              expiryDate: undefined,
              location: t.location,
              createdAt,
            }));
          return { ...prev, inventoryItems: [...toAdd, ...prev.inventoryItems] };
        });
      },
    };
  }, []);

  const value = React.useMemo<DashboardStore>(() => ({ data, actions }), [actions, data]);

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData() {
  const ctx = React.useContext(DashboardDataContext);
  if (!ctx) throw new Error("useDashboardData must be used within DashboardDataProvider");
  return ctx;
}

