import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { toast } from "@/components/ui/use-toast";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;
type Technician = Tables<"technicians">;
type JobCard = Tables<"job_cards">;
type InventoryItem = Tables<"inventory_items">;

export type DashboardData = {
  customers: Customer[];
  technicians: Technician[];
  jobCards: JobCard[];
  inventoryItems: InventoryItem[];
};

type DashboardActions = {
  addCustomer: (c: Omit<TablesInsert<"customers">, "company_id">) => Promise<Customer | null>;
  addTechnician: (t: Omit<TablesInsert<"technicians">, "company_id">) => Promise<Technician | null>;
  addJobCard: (j: Omit<TablesInsert<"job_cards">, "company_id">) => Promise<JobCard | null>;
  setJobCardStatus: (id: string, status: string) => Promise<void>;
  addInventoryItem: (i: Omit<TablesInsert<"inventory_items">, "company_id">) => Promise<InventoryItem | null>;
  adjustInventory: (itemId: string, delta: number) => Promise<void>;
  refreshData: () => Promise<void>;
};

type DashboardStore = {
  data: DashboardData;
  actions: DashboardActions;
  loading: boolean;
};

const DashboardDataContext = React.createContext<DashboardStore | null>(null);

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  const [data, setData] = React.useState<DashboardData>({
    customers: [],
    technicians: [],
    jobCards: [],
    inventoryItems: [],
  });
  const [loading, setLoading] = React.useState(true);

  const fetchAll = React.useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [customersRes, techRes, jobsRes, invRes] = await Promise.all([
      supabase.from("customers").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
      supabase.from("technicians").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
      supabase.from("job_cards").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
      supabase.from("inventory_items").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
    ]);
    setData({
      customers: customersRes.data ?? [],
      technicians: techRes.data ?? [],
      jobCards: jobsRes.data ?? [],
      inventoryItems: invRes.data ?? [],
    });
    setLoading(false);
  }, [companyId]);

  React.useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const actions = React.useMemo<DashboardActions>(() => ({
    addCustomer: async (c) => {
      if (!companyId) return null;
      const { data: row, error } = await supabase
        .from("customers")
        .insert({ ...c, company_id: companyId })
        .select()
        .single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
      setData((prev) => ({ ...prev, customers: [row, ...prev.customers] }));
      return row;
    },
    addTechnician: async (t) => {
      if (!companyId) return null;
      const { data: row, error } = await supabase
        .from("technicians")
        .insert({ ...t, company_id: companyId })
        .select()
        .single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
      setData((prev) => ({ ...prev, technicians: [row, ...prev.technicians] }));
      return row;
    },
    addJobCard: async (j) => {
      if (!companyId) return null;
      const { data: row, error } = await supabase
        .from("job_cards")
        .insert({ ...j, company_id: companyId })
        .select()
        .single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
      setData((prev) => ({ ...prev, jobCards: [row, ...prev.jobCards] }));
      return row;
    },
    setJobCardStatus: async (id, status) => {
      const { error } = await supabase
        .from("job_cards")
        .update({ status: status as any })
        .eq("id", id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      setData((prev) => ({
        ...prev,
        jobCards: prev.jobCards.map((j) => (j.id === id ? { ...j, status: status as any, updated_at: new Date().toISOString() } : j)),
      }));
    },
    addInventoryItem: async (i) => {
      if (!companyId) return null;
      const { data: row, error } = await supabase
        .from("inventory_items")
        .insert({ ...i, company_id: companyId })
        .select()
        .single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
      setData((prev) => ({ ...prev, inventoryItems: [row, ...prev.inventoryItems] }));
      return row;
    },
    adjustInventory: async (itemId, delta) => {
      const item = data.inventoryItems.find((i) => i.id === itemId);
      if (!item) return;
      const newQty = Math.max(0, item.quantity_on_hand + delta);
      const { error } = await supabase
        .from("inventory_items")
        .update({ quantity_on_hand: newQty })
        .eq("id", itemId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      setData((prev) => ({
        ...prev,
        inventoryItems: prev.inventoryItems.map((i) => (i.id === itemId ? { ...i, quantity_on_hand: newQty } : i)),
      }));
    },
    refreshData: fetchAll,
  }), [companyId, data.inventoryItems, fetchAll]);

  const value = React.useMemo<DashboardStore>(() => ({ data, actions, loading }), [data, actions, loading]);

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData() {
  const ctx = React.useContext(DashboardDataContext);
  if (!ctx) throw new Error("useDashboardData must be used within DashboardDataProvider");
  return ctx;
}
