import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { toast } from "@/components/ui/use-toast";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;
type Technician = Tables<"technicians">;
type JobCard = Tables<"job_cards">;
type Invoice = Tables<"invoices">;
type InvoicePayment = Tables<"invoice_payments">;
type InventoryItem = Tables<"inventory_items">;
type Site = Tables<"sites">;
type Team = Tables<"teams">;
type TeamMember = Tables<"team_members">;
type SiteTeamAssignment = Tables<"site_team_assignments">;
type Company = Tables<"companies">;
type TechnicianLocation = Tables<"technician_locations">;
type JobTimeEntry = any;
type SiteMaterialUsage = any;

type JobCardUpdate = Omit<TablesUpdate<"job_cards">, "company_id" | "id" | "created_at" | "updated_at">;

export type DashboardData = {
  company: Company | null;
  customers: Customer[];
  technicians: Technician[];
  jobCards: JobCard[];
  invoices: Invoice[];
  invoicePayments: InvoicePayment[];
  inventoryItems: InventoryItem[];
  sites: Site[];
  teams: Team[];
  teamMembers: TeamMember[];
  siteTeamAssignments: SiteTeamAssignment[];
  technicianLocations: TechnicianLocation[];
  jobTimeEntries: JobTimeEntry[];
  siteMaterialUsage: SiteMaterialUsage[];
};

type DashboardActions = {
  addCustomer: (c: Omit<TablesInsert<"customers">, "company_id">) => Promise<Customer | null>;
  updateCustomer: (customerId: string, c: Partial<Omit<TablesInsert<"customers">, "company_id">>) => Promise<Customer | null>;
  deleteCustomer: (customerId: string) => Promise<void>;
  addTechnician: (t: Omit<TablesInsert<"technicians">, "company_id">) => Promise<Technician | null>;
  updateTechnician: (technicianId: string, t: Partial<Omit<TablesInsert<"technicians">, "company_id">>) => Promise<Technician | null>;
  deleteTechnician: (technicianId: string) => Promise<void>;
  addJobCard: (j: Omit<TablesInsert<"job_cards">, "company_id">) => Promise<JobCard | null>;
  updateJobCard: (id: string, patch: JobCardUpdate) => Promise<JobCard | null>;
  setJobCardStatus: (id: string, status: string) => Promise<void>;
  setJobCardSite: (id: string, siteId: string | null) => Promise<void>;
  setJobCardTechnician: (id: string, technicianId: string | null) => Promise<void>;
  setJobRevenue: (id: string, revenueCents: number | null) => Promise<void>;
  addInventoryItem: (i: Omit<TablesInsert<"inventory_items">, "company_id">) => Promise<InventoryItem | null>;
  adjustInventory: (itemId: string, delta: number) => Promise<void>;
  setInventoryUnitCost: (itemId: string, unitCostCents: number | null) => Promise<void>;
  addSite: (s: Omit<TablesInsert<"sites">, "company_id">) => Promise<Site | null>;
  updateSite: (siteId: string, s: Partial<Omit<TablesInsert<"sites">, "company_id">>) => Promise<Site | null>;
  deleteSite: (siteId: string) => Promise<void>;
  addTeam: (t: Omit<TablesInsert<"teams">, "company_id">) => Promise<Team | null>;
  setTechnicianRates: (technicianId: string, args: { hourlyCostCents: number | null; hourlyBillRateCents: number | null }) => Promise<void>;
  addTeamMember: (teamId: string, technicianId: string) => Promise<TeamMember | null>;
  removeTeamMember: (teamMemberId: string) => Promise<void>;
  assignTeamToSite: (a: { siteId: string; teamId: string; company_id?: string; startsAt?: string; endsAt?: string | null; notes?: string | null }) => Promise<SiteTeamAssignment | null>;
  endSiteAssignment: (assignmentId: string, endsAt: string) => Promise<void>;
  refreshData: (opts?: { silent?: boolean }) => Promise<void>;
};

type DashboardStore = {
  data: DashboardData;
  actions: DashboardActions;
  loading: boolean;
  companyState:
    | { kind: "none" }
    | { kind: "loading" }
    | { kind: "ok" }
    | { kind: "missing" }
    | { kind: "error"; message: string; status?: number | null };
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
  const { profile, loading: authLoading, profileLoading, rolesLoading, profileError, rolesError } = useAuth();
  const companyId = profile?.company_id;

  const [data, setData] = React.useState<DashboardData>({
    company: null,
    customers: [],
    technicians: [],
    jobCards: [],
    invoices: [],
    invoicePayments: [],
    inventoryItems: [],
    sites: [],
    teams: [],
    teamMembers: [],
    siteTeamAssignments: [],
    technicianLocations: [],
    jobTimeEntries: [],
    siteMaterialUsage: [],
  });
  const [loading, setLoading] = React.useState(true);
  const [companyState, setCompanyState] = React.useState<DashboardStore["companyState"]>({ kind: "none" });
  const fetchErrorShownRef = React.useRef(new Set<string>());
  const hasLoadedOnceRef = React.useRef(false);
  const prevCompanyIdRef = React.useRef<string | null | undefined>(undefined);

  // When the company changes (including after company creation or deletion), reset all
  // stale data immediately so the old company's industry dashboard never bleeds through.
  React.useEffect(() => {
    if (prevCompanyIdRef.current === undefined) {
      prevCompanyIdRef.current = companyId;
      return;
    }
    if (prevCompanyIdRef.current === companyId) return;
    prevCompanyIdRef.current = companyId;
    hasLoadedOnceRef.current = false;
    fetchErrorShownRef.current = new Set();
    setData({
      company: null,
      customers: [],
      technicians: [],
      jobCards: [],
      invoices: [],
      invoicePayments: [],
      inventoryItems: [],
      sites: [],
      teams: [],
      teamMembers: [],
      siteTeamAssignments: [],
      technicianLocations: [],
      jobTimeEntries: [],
      siteMaterialUsage: [],
    });
    if (!companyId) {
      setCompanyState({ kind: "none" });
      setLoading(false);
    } else {
      setCompanyState({ kind: "loading" });
    }
  }, [companyId]);

  const fetchAll = React.useCallback(async (opts?: { silent?: boolean }) => {
    if (profileError) {
      setCompanyState({ kind: "error", message: profileError });
      setLoading(false);
      return;
    }
    if (rolesError) {
      setCompanyState({ kind: "error", message: rolesError });
      setLoading(false);
      return;
    }
    if (authLoading || profileLoading || rolesLoading) {
      // Avoid showing "No company yet" while auth/profile/roles are still resolving.
      // If we've already loaded data once, keep rendering the current dashboard state
      // instead of flipping back to a global spinner on token refresh.
      if (!hasLoadedOnceRef.current) {
        setCompanyState(companyId ? { kind: "loading" } : { kind: "none" });
        setLoading(true);
      }
      return;
    }
    if (!companyId) {
      setCompanyState({ kind: "none" });
      setLoading(false);
      return;
    }
    if (!opts?.silent || !hasLoadedOnceRef.current) setCompanyState({ kind: "loading" });
    if (!opts?.silent) setLoading(true);
    let companyRes: any;
    let customersRes: any;
    let techRes: any;
    let jobsRes: any;
    let invoicesRes: any;
    let invoicePaysRes: any;
    let invRes: any;
    let sitesRes: any;
    let teamsRes: any;
    let teamMembersRes: any;
    let assignmentsRes: any;
    let locationsRes: any;
    let timeRes: any;
    let materialRes: any;

    try {
      [companyRes, customersRes, techRes, jobsRes, invoicesRes, invoicePaysRes, invRes, sitesRes, teamsRes, teamMembersRes, assignmentsRes, locationsRes] = await Promise.all([
        supabase.from("companies").select("*").eq("id", companyId).maybeSingle(),
        supabase.from("customers").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        supabase.from("technicians").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        supabase.from("job_cards").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        supabase.from("invoices").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        supabase.from("invoice_payments").select("*").eq("company_id", companyId).order("paid_at", { ascending: false }),
        supabase.from("inventory_items").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        supabase.from("sites").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        supabase.from("teams").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        supabase.from("team_members").select("*").order("created_at", { ascending: false }),
        supabase.from("site_team_assignments").select("*").order("created_at", { ascending: false }),
        supabase.from("technician_locations").select("*").eq("company_id", companyId).order("updated_at", { ascending: false }),
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
      setCompanyState({ kind: "error", message: e?.message ?? "Network error while fetching dashboard data." });
      return;
    }

    const results = [
      { name: "companies", res: companyRes },
      { name: "customers", res: customersRes },
      { name: "technicians", res: techRes },
      { name: "job_cards", res: jobsRes },
      { name: "invoices", res: invoicesRes },
      { name: "invoice_payments", res: invoicePaysRes },
      { name: "inventory_items", res: invRes },
      { name: "sites", res: sitesRes },
      { name: "teams", res: teamsRes },
      { name: "team_members", res: teamMembersRes },
      { name: "site_team_assignments", res: assignmentsRes },
      { name: "technician_locations", res: locationsRes },
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
        invoices: invoicesRes.data ?? [],
        invoicePayments: invoicePaysRes.data ?? [],
        inventoryItems: invRes.data ?? [],
        sites: sitesRes.data ?? [],
        teams: teamsRes.data ?? [],
        teamMembers: teamMembersRes.data ?? [],
        siteTeamAssignments: assignmentsRes.data ?? [],
        technicianLocations: locationsRes.data ?? [],
        jobTimeEntries: timeRes?.data ?? [],
        siteMaterialUsage: materialRes?.data ?? [],
      };
    });

    const companyErr: any = companyRes?.error ?? null;
    if (companyErr) {
      setCompanyState({
        kind: "error",
        message: companyErr.message ?? "Failed to load company",
        status: (companyRes as any)?.status ?? companyErr.status ?? null,
      });
    } else if (!companyRes?.data) {
      setCompanyState({ kind: "missing" });
    } else {
      setCompanyState({ kind: "ok" });
    }
    hasLoadedOnceRef.current = true;
    if (!opts?.silent) setLoading(false);
  }, [authLoading, companyId, profileError, profileLoading, rolesError, rolesLoading]);

  React.useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  React.useEffect(() => {
    if (!companyId) return;

    const upsertByKey = <T,>(items: T[], row: T, key: keyof T) => {
      const k = String((row as any)?.[key] ?? "");
      if (!k) return items;
      const idx = items.findIndex((x: any) => String(x?.[key] ?? "") === k);
      if (idx === -1) return [row, ...items];
      const next = items.slice();
      next[idx] = row;
      return next;
    };

    const channel = supabase
      .channel(`dashboard-live:${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_cards", filter: `company_id=eq.${companyId}` },
        (payload: any) => {
          const type = payload?.eventType as string;
          if (type === "DELETE") {
            const id = payload?.old?.id as string | undefined;
            if (!id) return;
            setData((prev) => ({ ...prev, jobCards: prev.jobCards.filter((j) => j.id !== id) }));
            return;
          }
          const row = payload?.new as JobCard | undefined;
          if (!row?.id) return;
          setData((prev) => ({ ...prev, jobCards: upsertByKey(prev.jobCards, row, "id") }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices", filter: `company_id=eq.${companyId}` },
        (payload: any) => {
          const type = payload?.eventType as string;
          if (type === "DELETE") {
            const id = payload?.old?.id as string | undefined;
            if (!id) return;
            setData((prev) => ({ ...prev, invoices: prev.invoices.filter((i) => i.id !== id) }));
            return;
          }
          const row = payload?.new as Invoice | undefined;
          if (!row?.id) return;
          setData((prev) => ({ ...prev, invoices: upsertByKey(prev.invoices, row, "id") }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoice_payments", filter: `company_id=eq.${companyId}` },
        (payload: any) => {
          const type = payload?.eventType as string;
          if (type === "DELETE") {
            const id = payload?.old?.id as string | undefined;
            if (!id) return;
            setData((prev) => ({ ...prev, invoicePayments: prev.invoicePayments.filter((p) => p.id !== id) }));
            return;
          }
          const row = payload?.new as InvoicePayment | undefined;
          if (!row?.id) return;
          setData((prev) => ({ ...prev, invoicePayments: upsertByKey(prev.invoicePayments, row, "id") }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "technician_locations", filter: `company_id=eq.${companyId}` },
        (payload: any) => {
          const type = payload?.eventType as string;
          if (type === "DELETE") {
            const technicianId = payload?.old?.technician_id as string | undefined;
            if (!technicianId) return;
            setData((prev) => ({
              ...prev,
              technicianLocations: prev.technicianLocations.filter((l: any) => (l as any).technician_id !== technicianId),
            }));
            return;
          }
          const row = payload?.new as TechnicianLocation | undefined;
          const technicianId = (row as any)?.technician_id as string | undefined;
          if (!technicianId) return;
          setData((prev) => ({ ...prev, technicianLocations: upsertByKey(prev.technicianLocations, row, "technician_id") }));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void fetchAll({ silent: true });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

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
    updateCustomer: async (customerId, c) => {
      const { data: row, error } = await supabase
        .from("customers")
        .update(c as any)
        .eq("id", customerId)
        .select()
        .single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
      setData((prev) => ({
        ...prev,
        customers: prev.customers.map((x) => (x.id === customerId ? row : x)),
      }));
      return row;
    },
    deleteCustomer: async (customerId) => {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customerId);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      setData((prev) => ({
        ...prev,
        customers: prev.customers.filter((c) => c.id !== customerId),
        sites: prev.sites.map((s: any) => ((s as any).customer_id === customerId ? { ...s, customer_id: null } : s)),
        jobCards: prev.jobCards.map((j: any) => ((j as any).customer_id === customerId ? { ...j, customer_id: null } : j)),
      }));
      toast({ title: "Customer deleted" });
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
    updateJobCard: async (id, patch) => {
      const { data: row, error } = await supabase
        .from("job_cards")
        .update(patch as any)
        .eq("id", id)
        .select()
        .single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
      setData((prev) => ({
        ...prev,
        jobCards: prev.jobCards.map((j) => (j.id === id ? row : j)),
      }));
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
    setJobCardTechnician: async (id, technicianId) => {
      const { error } = await supabase
        .from("job_cards")
        .update({ technician_id: technicianId })
        .eq("id", id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      setData((prev) => ({
        ...prev,
        jobCards: prev.jobCards.map((j: any) => (j.id === id ? { ...j, technician_id: technicianId, updated_at: new Date().toISOString() } : j)),
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
    updateSite: async (siteId, s) => {
      const { data: row, error } = await supabase
        .from("sites")
        .update(s as any)
        .eq("id", siteId)
        .select()
        .single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
      setData((prev) => ({
        ...prev,
        sites: prev.sites.map((x) => (x.id === siteId ? row : x)),
      }));
      return row;
    },
    deleteSite: async (siteId) => {
      const { error } = await supabase
        .from("sites")
        .delete()
        .eq("id", siteId);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      setData((prev) => ({
        ...prev,
        sites: prev.sites.filter((s) => s.id !== siteId),
        siteTeamAssignments: prev.siteTeamAssignments.filter((a) => a.site_id !== siteId),
        siteMaterialUsage: (prev.siteMaterialUsage as any[]).filter((u) => u.site_id !== siteId),
        jobCards: prev.jobCards.map((j: any) => ((j as any).site_id === siteId ? { ...j, site_id: null } : j)),
      }));
      toast({ title: "Site deleted" });
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
    assignTeamToSite: async ({ siteId, company_id, teamId, startsAt, endsAt, notes }) => {
      const { data: row, error } = await (supabase as any)
        .from("site_team_assignments")
        .insert({
          site_id: siteId,
          company_id: company_id ?? companyId,
          team_id: teamId,
          starts_at: startsAt ?? new Date().toISOString(),
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

  const value = React.useMemo<DashboardStore>(() => ({ data, actions, loading, companyState }), [data, actions, loading, companyState]);

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData() {
  const ctx = React.useContext(DashboardDataContext);
  if (!ctx) throw new Error("useDashboardData must be used within DashboardDataProvider");
  return ctx;
}
