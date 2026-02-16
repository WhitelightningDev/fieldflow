import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { toast } from "@/components/ui/use-toast";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;
type Technician = Tables<"technicians">;
type JobCard = Tables<"job_cards">;
type InventoryItem = Tables<"inventory_items">;
type Site = Tables<"sites">;
type Team = Tables<"teams">;
type TeamMember = Tables<"team_members">;
type SiteTeamAssignment = Tables<"site_team_assignments">;
type Company = Tables<"companies">;
type JobTimeEntry = any;
type SiteMaterialUsage = any;

export type DashboardData = {
  company: Company | null;
  customers: Customer[];
  technicians: Technician[];
  jobCards: JobCard[];
  inventoryItems: InventoryItem[];
  sites: Site[];
  teams: Team[];
  teamMembers: TeamMember[];
  siteTeamAssignments: SiteTeamAssignment[];
  jobTimeEntries: JobTimeEntry[];
  siteMaterialUsage: SiteMaterialUsage[];
};

type DashboardActions = {
  addCustomer: (c: Omit<TablesInsert<"customers">, "company_id">) => Promise<Customer | null>;
  addTechnician: (t: Omit<TablesInsert<"technicians">, "company_id">) => Promise<Technician | null>;
  updateTechnician: (technicianId: string, t: Partial<Omit<TablesInsert<"technicians">, "company_id">>) => Promise<Technician | null>;
  deleteTechnician: (technicianId: string) => Promise<void>;
  addJobCard: (j: Omit<TablesInsert<"job_cards">, "company_id">) => Promise<JobCard | null>;
  setJobCardStatus: (id: string, status: string) => Promise<void>;
  setJobCardSite: (id: string, siteId: string | null) => Promise<void>;
  setJobRevenue: (id: string, revenueCents: number | null) => Promise<void>;
  addInventoryItem: (i: Omit<TablesInsert<"inventory_items">, "company_id">) => Promise<InventoryItem | null>;
  adjustInventory: (itemId: string, delta: number) => Promise<void>;
  setInventoryUnitCost: (itemId: string, unitCostCents: number | null) => Promise<void>;
  addSite: (s: Omit<TablesInsert<"sites">, "company_id">) => Promise<Site | null>;
  addTeam: (t: Omit<TablesInsert<"teams">, "company_id">) => Promise<Team | null>;
  setTechnicianRates: (technicianId: string, args: { hourlyCostCents: number | null; hourlyBillRateCents: number | null }) => Promise<void>;
  addTeamMember: (teamId: string, technicianId: string) => Promise<TeamMember | null>;
  removeTeamMember: (teamMemberId: string) => Promise<void>;
  assignTeamToSite: (a: { siteId: string; teamId: string; startsAt?: string; endsAt?: string | null; notes?: string | null }) => Promise<SiteTeamAssignment | null>;
  endSiteAssignment: (assignmentId: string, endsAt: string) => Promise<void>;
  refreshData: () => Promise<void>;
};

type DashboardStore = {
  data: DashboardData;
  actions: DashboardActions;
  loading: boolean;
};

const DashboardDataContext = React.createContext<DashboardStore | null>(null);

function mergeById<T extends { id: string }>(primary: T[], fallback: T[]) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of primary) {
    if (!item?.id) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  for (const item of fallback) {
    if (!item?.id) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  const [data, setData] = React.useState<DashboardData>({
    company: null,
    customers: [],
    technicians: [],
    jobCards: [],
    inventoryItems: [],
    sites: [],
    teams: [],
    teamMembers: [],
    siteTeamAssignments: [],
    jobTimeEntries: [],
    siteMaterialUsage: [],
  });
  const [loading, setLoading] = React.useState(true);
  const fetchErrorShownRef = React.useRef(new Set<string>());

  const fetchAll = React.useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let companyRes: any;
    let customersRes: any;
    let techRes: any;
    let jobsRes: any;
    let invRes: any;
    let sitesRes: any;
    let teamsRes: any;
    let teamMembersRes: any;
    let assignmentsRes: any;
    let timeRes: any;
    let materialRes: any;

    try {
      [companyRes, customersRes, techRes, jobsRes, invRes, sitesRes, teamsRes, teamMembersRes, assignmentsRes] = await Promise.all([
        supabase.from("companies").select("*").eq("id", companyId).maybeSingle(),
        supabase.from("customers").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        supabase.from("technicians").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        supabase.from("job_cards").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        supabase.from("inventory_items").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        supabase.from("sites").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        supabase.from("teams").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        supabase.from("team_members").select("*").order("created_at", { ascending: false }),
        supabase.from("site_team_assignments").select("*").order("created_at", { ascending: false }),
      ]);

      const jobIds = (jobsRes.data ?? []).map((j: any) => j.id).filter(Boolean);
      const siteIds = (sitesRes.data ?? []).map((s: any) => s.id).filter(Boolean);
      [timeRes, materialRes] = await Promise.all([
        jobIds.length > 0
          ? supabase.from("job_time_entries").select("*").in("job_card_id", jobIds).order("started_at", { ascending: false })
          : Promise.resolve({ data: [], error: null, status: 200 }),
        siteIds.length > 0
          ? supabase.from("site_material_usage").select("*").in("site_id", siteIds).order("used_at", { ascending: false })
          : Promise.resolve({ data: [], error: null, status: 200 }),
      ]);
    } catch (e: any) {
      toast({
        title: "Dashboard data unavailable",
        description: e?.message ?? "Network error while fetching dashboard data.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const results = [
      { name: "companies", res: companyRes },
      { name: "customers", res: customersRes },
      { name: "technicians", res: techRes },
      { name: "job_cards", res: jobsRes },
      { name: "inventory_items", res: invRes },
      { name: "sites", res: sitesRes },
      { name: "teams", res: teamsRes },
      { name: "team_members", res: teamMembersRes },
      { name: "site_team_assignments", res: assignmentsRes },
      { name: "job_time_entries", res: timeRes },
      { name: "site_material_usage", res: materialRes },
    ] as const;

    for (const r of results) {
      const err: any = (r.res as any).error;
      if (!err) continue;
      const key = `${r.name}:${err.code ?? err.message ?? "unknown"}`;
      if (fetchErrorShownRef.current.has(key)) continue;
      fetchErrorShownRef.current.add(key);

      const status = (r.res as any).status ?? err.status;
      const isMissingOrNoPriv =
        status === 404 ||
        String(err.message ?? "").toLowerCase().includes("could not find the table") ||
        String(err.message ?? "").toLowerCase().includes("schema cache");

      toast({
        title: "Dashboard data unavailable",
        description: isMissingOrNoPriv
          ? `Supabase REST can't access "${r.name}" (404). Apply migrations and grants, then redeploy.`
          : `${r.name}: ${err.message ?? "Unknown error"}`,
        variant: "destructive",
      });
    }

    setData((prev) => {
      const fetchedCustomers = (customersRes.data ?? []) as Customer[];
      const prevCustomers = (prev.customers ?? []).filter((c) => (c as any).company_id === companyId) as Customer[];

      return {
        company: companyRes.data ?? null,
        customers: mergeById(fetchedCustomers, prevCustomers),
        technicians: techRes.data ?? [],
        jobCards: jobsRes.data ?? [],
        inventoryItems: invRes.data ?? [],
        sites: sitesRes.data ?? [],
        teams: teamsRes.data ?? [],
        teamMembers: teamMembersRes.data ?? [],
        siteTeamAssignments: assignmentsRes.data ?? [],
        jobTimeEntries: timeRes?.data ?? [],
        siteMaterialUsage: materialRes?.data ?? [],
      };
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
    updateTechnician: async (technicianId, t) => {
      const { data: row, error } = await supabase
        .from("technicians")
        .update(t as any)
        .eq("id", technicianId)
        .select()
        .single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
      setData((prev) => ({
        ...prev,
        technicians: prev.technicians.map((x) => (x.id === technicianId ? row : x)),
      }));
      return row;
    },
    deleteTechnician: async (technicianId) => {
      const { error } = await supabase
        .from("technicians")
        .delete()
        .eq("id", technicianId);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      setData((prev) => ({
        ...prev,
        technicians: prev.technicians.filter((t) => t.id !== technicianId),
        teamMembers: prev.teamMembers.filter((m: any) => m.technician_id !== technicianId),
        jobCards: prev.jobCards.map((j: any) => (j.technician_id === technicianId ? { ...j, technician_id: null } : j)),
        jobTimeEntries: prev.jobTimeEntries.map((e: any) => (e.technician_id === technicianId ? { ...e, technician_id: null } : e)),
      }));
      toast({ title: "Technician deleted" });
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
    setJobCardSite: async (id, siteId) => {
      const { error } = await supabase
        .from("job_cards")
        .update({ site_id: siteId })
        .eq("id", id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      setData((prev) => ({
        ...prev,
        jobCards: prev.jobCards.map((j) => (j.id === id ? { ...j, site_id: siteId, updated_at: new Date().toISOString() } : j)),
      }));
    },
    setJobRevenue: async (id, revenueCents) => {
      const { error } = await supabase
        .from("job_cards")
        .update({ revenue_cents: revenueCents })
        .eq("id", id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      setData((prev) => ({
        ...prev,
        jobCards: prev.jobCards.map((j: any) => (j.id === id ? { ...j, revenue_cents: revenueCents, updated_at: new Date().toISOString() } : j)),
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
    setInventoryUnitCost: async (itemId, unitCostCents) => {
      const { error } = await supabase
        .from("inventory_items")
        .update({ unit_cost_cents: unitCostCents })
        .eq("id", itemId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      setData((prev) => ({
        ...prev,
        inventoryItems: prev.inventoryItems.map((i: any) => (i.id === itemId ? { ...i, unit_cost_cents: unitCostCents } : i)),
      }));
    },
    addSite: async (s) => {
      if (!companyId) return null;
      const { data: row, error } = await supabase
        .from("sites")
        .insert({ ...s, company_id: companyId })
        .select()
        .single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
      setData((prev) => ({ ...prev, sites: [row, ...prev.sites] }));
      return row;
    },
    addTeam: async (t) => {
      if (!companyId) return null;
      const { data: row, error } = await supabase
        .from("teams")
        .insert({ ...t, company_id: companyId })
        .select()
        .single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
      setData((prev) => ({ ...prev, teams: [row, ...prev.teams] }));
      return row;
    },
    setTechnicianRates: async (technicianId, { hourlyCostCents, hourlyBillRateCents }) => {
      const { error } = await supabase
        .from("technicians")
        .update({ hourly_cost_cents: hourlyCostCents, hourly_bill_rate_cents: hourlyBillRateCents })
        .eq("id", technicianId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      setData((prev) => ({
        ...prev,
        technicians: prev.technicians.map((t: any) =>
          t.id === technicianId ? { ...t, hourly_cost_cents: hourlyCostCents, hourly_bill_rate_cents: hourlyBillRateCents } : t
        ),
      }));
    },
    addTeamMember: async (teamId, technicianId) => {
      const tech = data.technicians.find((t) => t.id === technicianId);
      if (!tech) { toast({ title: "Error", description: "Technician not found", variant: "destructive" }); return null; }
      const companyId = data.company?.id;
      const { data: row, error } = await supabase
        .from("team_members")
        .insert({ team_id: teamId, full_name: tech.name, email: tech.email, phone: tech.phone, company_id: companyId })
        .select()
        .single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
      setData((prev) => ({ ...prev, teamMembers: [row, ...prev.teamMembers] }));
      return row;
    },
    removeTeamMember: async (teamMemberId) => {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("id", teamMemberId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      setData((prev) => ({ ...prev, teamMembers: prev.teamMembers.filter((m) => m.id !== teamMemberId) }));
    },
    assignTeamToSite: async ({ siteId, teamId, startsAt, endsAt, notes }) => {
      const { data: row, error } = await (supabase as any)
        .from("site_team_assignments")
        .insert({
          site_id: siteId,
          team_id: teamId,
          starts_at: startsAt ?? undefined,
          ends_at: endsAt ?? null,
          notes: notes ?? null,
        })
        .select()
        .single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
      setData((prev) => ({ ...prev, siteTeamAssignments: [row, ...prev.siteTeamAssignments] }));
      return row;
    },
    endSiteAssignment: async (assignmentId, endsAt) => {
      const { data: row, error } = await (supabase as any)
        .from("site_team_assignments")
        .update({ ends_at: endsAt })
        .eq("id", assignmentId)
        .select()
        .single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      setData((prev) => ({
        ...prev,
        siteTeamAssignments: prev.siteTeamAssignments.map((a) => (a.id === assignmentId ? row : a)),
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
