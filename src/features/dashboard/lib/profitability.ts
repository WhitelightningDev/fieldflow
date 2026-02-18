import type { Tables } from "@/integrations/supabase/types";

type JobCard = Tables<"job_cards">;
type JobTimeEntry = any;
type SiteMaterialUsage = any;
type Technician = Tables<"technicians">;
type InventoryItem = Tables<"inventory_items">;

function minutesForEntry(e: JobTimeEntry) {
  if (typeof e.minutes === "number") return Math.max(0, e.minutes);
  if (e.started_at && e.ended_at) {
    const ms = new Date(e.ended_at).getTime() - new Date(e.started_at).getTime();
    return Math.max(0, Math.round(ms / 60000));
  }
  return 0;
}

export type Profitability = {
  revenueCents: number | null;
  laborCostCents: number;
  materialCostCents: number;
  wasteCostCents: number;
  grossMarginCents: number | null;
  grossMarginPct: number | null;
  complete: boolean;
};

export function computeJobProfitability(args: {
  job: JobCard;
  timeEntries: JobTimeEntry[];
  materials: SiteMaterialUsage[];
  techniciansById: Map<string, Technician>;
  inventoryById: Map<string, InventoryItem>;
  labourOverheadPercent?: number;
}): Profitability {
  const { job, timeEntries, materials, techniciansById, inventoryById } = args;
  const overheadPct = typeof args.labourOverheadPercent === "number" ? args.labourOverheadPercent : 15;

  const revenueCents = typeof (job as any).revenue_cents === "number" ? (job as any).revenue_cents : null;

  let laborBaseCostCents = 0;
  let materialCostCents = 0;
  let wasteCostCents = 0;
  let missingRates = false;

  for (const t of timeEntries) {
    const mins = minutesForEntry(t);
    if (mins === 0) continue;
    const techId: string | null = t.technician_id ?? job.technician_id ?? null;
    if (!techId) { missingRates = true; continue; }
    const tech: any = techniciansById.get(techId);
    const rate = typeof tech?.hourly_cost_cents === "number" ? tech.hourly_cost_cents : null;
    if (rate === null) { missingRates = true; continue; }
    laborBaseCostCents += Math.round((mins * rate) / 60);
  }

  for (const m of materials) {
    const item: any = inventoryById.get(m.inventory_item_id);
    const unitCost = typeof item?.unit_cost_cents === "number" ? item.unit_cost_cents : null;
    if (unitCost === null) { missingRates = true; continue; }
    const used = typeof m.quantity_used === "number" ? m.quantity_used : 0;
    const wasted = typeof m.quantity_wasted === "number" ? m.quantity_wasted : 0;
    materialCostCents += (used + wasted) * unitCost;
    wasteCostCents += wasted * unitCost;
  }

  const laborCostCents = Math.round(laborBaseCostCents * (1 + overheadPct / 100));
  const complete = revenueCents !== null && !missingRates;
  const grossMarginCents = revenueCents === null ? null : revenueCents - laborCostCents - materialCostCents;
  const grossMarginPct =
    revenueCents && revenueCents !== 0 && grossMarginCents !== null ? grossMarginCents / revenueCents : null;

  return {
    revenueCents,
    laborCostCents,
    materialCostCents,
    wasteCostCents,
    grossMarginCents,
    grossMarginPct,
    complete,
  };
}

export function computeSiteProfitability(args: {
  jobs: JobCard[];
  timeEntries: JobTimeEntry[];
  materials: SiteMaterialUsage[];
  techniciansById: Map<string, Technician>;
  inventoryById: Map<string, InventoryItem>;
  labourOverheadPercent?: number;
}): Profitability {
  const { jobs, timeEntries, materials, techniciansById, inventoryById } = args;
  const overheadPct = typeof args.labourOverheadPercent === "number" ? args.labourOverheadPercent : 15;

  let revenueCents = 0;
  let missingRevenue = false;
  let laborBaseCostCents = 0;
  let materialCostCents = 0;
  let wasteCostCents = 0;
  let missingRates = false;

  const jobIds = new Set(jobs.map((j) => j.id));

  for (const j of jobs) {
    const r = typeof (j as any).revenue_cents === "number" ? (j as any).revenue_cents : null;
    if (r === null) missingRevenue = true;
    else revenueCents += r;
  }

  for (const t of timeEntries) {
    if (!jobIds.has(t.job_card_id)) continue;
    const mins = minutesForEntry(t);
    if (mins === 0) continue;
    const techId: string | null = t.technician_id ?? null;
    if (!techId) { missingRates = true; continue; }
    const tech: any = techniciansById.get(techId);
    const rate = typeof tech?.hourly_cost_cents === "number" ? tech.hourly_cost_cents : null;
    if (rate === null) { missingRates = true; continue; }
    laborBaseCostCents += Math.round((mins * rate) / 60);
  }

  for (const m of materials) {
    const item: any = inventoryById.get(m.inventory_item_id);
    const unitCost = typeof item?.unit_cost_cents === "number" ? item.unit_cost_cents : null;
    if (unitCost === null) { missingRates = true; continue; }
    const used = typeof m.quantity_used === "number" ? m.quantity_used : 0;
    const wasted = typeof m.quantity_wasted === "number" ? m.quantity_wasted : 0;
    materialCostCents += (used + wasted) * unitCost;
    wasteCostCents += wasted * unitCost;
  }

  const laborCostCents = Math.round(laborBaseCostCents * (1 + overheadPct / 100));
  const finalRevenue = jobs.length === 0 ? null : revenueCents;
  const complete = finalRevenue !== null && !missingRevenue && !missingRates;
  const grossMarginCents = finalRevenue === null ? null : finalRevenue - laborCostCents - materialCostCents;
  const grossMarginPct =
    finalRevenue && finalRevenue !== 0 && grossMarginCents !== null ? grossMarginCents / finalRevenue : null;

  return {
    revenueCents: finalRevenue,
    laborCostCents,
    materialCostCents,
    wasteCostCents,
    grossMarginCents,
    grossMarginPct,
    complete,
  };
}
