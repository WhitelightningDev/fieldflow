import type { TradeId } from "@/features/company-signup/content/trades";
import type { Tables } from "@/integrations/supabase/types";
import { distanceMeters } from "@/lib/geo";

type JobCard = Tables<"job_cards">;
type Technician = Tables<"technicians">;
type TechnicianLocation = Tables<"technician_locations">;

export type JobSuggestion = {
  title: string;
  reason: string;
};

export type AssigneeSuggestion = {
  technicianId: string;
  reason: string;
  distanceMeters?: number;
};

const DEFAULT_JOB_TITLES: Record<TradeId, string[]> = {
  "electrical-contracting": [
    "Fault finding",
    "COC / compliance inspection",
    "DB board inspection",
    "Emergency call-out",
    "Solar system service",
    "Lighting repair / replacement",
  ],
  plumbing: [
    "Leak detection & repair",
    "Blocked drain / pipe clearing",
    "Geyser / water heater service",
    "Emergency call-out",
    "Toilet repair",
    "Tap / mixer replacement",
  ],
  "mobile-mechanics": [
    "Diagnostic scan",
    "Oil change service",
    "Brake inspection / replacement",
    "Battery test / replacement",
    "Minor service",
    "Emergency breakdown call-out",
  ],
  refrigeration: [
    "Refrigerant leak check",
    "Cold room service",
    "Compressor / fan check",
    "Emergency breakdown call-out",
    "Temperature calibration",
    "Maintenance visit",
  ],
  "appliance-repair": [
    "Fault finding",
    "Washing machine repair",
    "Dishwasher repair",
    "Oven / stove repair",
    "Preventative maintenance",
    "Warranty call-out",
  ],
};

function norm(s: unknown) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function isOpenJob(status: JobCard["status"]) {
  return status !== "invoiced" && status !== "cancelled";
}

function dedupeTitles(titles: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of titles) {
    const key = norm(t);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function getJobSuggestions(args: {
  tradeId: TradeId;
  customerId?: string | null;
  siteId?: string | null;
  jobCards: JobCard[];
  max?: number;
}): JobSuggestion[] {
  const max = Math.max(1, args.max ?? 6);
  const tradeJobs = args.jobCards.filter((j) => j.trade_id === args.tradeId);

  const openTitles = new Set<string>();
  for (const j of tradeJobs) {
    if (!isOpenJob(j.status)) continue;
    if (args.siteId && j.site_id === args.siteId) openTitles.add(norm(j.title));
    else if (!args.siteId && args.customerId && j.customer_id === args.customerId) openTitles.add(norm(j.title));
  }

  const suggestions: Array<{ title: string; reason: string; score: number }> = [];
  const push = (title: string, reason: string, score: number) => {
    const key = norm(title);
    if (!key) return;
    if (openTitles.has(key)) return;
    suggestions.push({ title, reason, score });
  };

  if (args.siteId) {
    const siteJobs = tradeJobs
      .filter((j) => j.site_id === args.siteId)
      .slice()
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    for (const title of dedupeTitles(siteJobs.map((j) => j.title)).slice(0, 3)) {
      push(title, "Recent at this site", 90);
    }
  }

  if (args.customerId) {
    const customerJobs = tradeJobs
      .filter((j) => j.customer_id === args.customerId)
      .slice()
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    for (const title of dedupeTitles(customerJobs.map((j) => j.title)).slice(0, 3)) {
      push(title, "Common for this customer", 80);
    }
  }

  const counts = new Map<string, { title: string; count: number; lastAt: number }>();
  for (const j of tradeJobs) {
    const key = norm(j.title);
    if (!key) continue;
    const current = counts.get(key) ?? { title: j.title, count: 0, lastAt: 0 };
    current.count += 1;
    current.lastAt = Math.max(current.lastAt, new Date(j.updated_at).getTime());
    counts.set(key, current);
  }
  const popular = [...counts.values()]
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : b.lastAt - a.lastAt))
    .slice(0, 6)
    .map((x) => x.title);
  for (const title of popular) {
    push(title, "Popular for this trade", 60);
  }

  for (const title of DEFAULT_JOB_TITLES[args.tradeId]) {
    push(title, "Common job", 40);
  }

  const byKey = new Map<string, { title: string; reason: string; score: number }>();
  for (const s of suggestions) {
    const key = norm(s.title);
    const existing = byKey.get(key);
    if (!existing || s.score > existing.score) byKey.set(key, s);
  }

  return [...byKey.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(({ title, reason }) => ({ title, reason }));
}

function pickMostRecentAssignedTechId(jobs: JobCard[], allowedTechIds: Set<string>) {
  const sorted = jobs
    .filter((j) => j.technician_id && allowedTechIds.has(j.technician_id))
    .slice()
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return sorted[0]?.technician_id ?? null;
}

function latestLocationByTechId(locations: TechnicianLocation[]) {
  const out = new Map<string, TechnicianLocation>();
  const timeOf = (l: TechnicianLocation) => {
    const t = l.updated_at ?? l.recorded_at ?? l.created_at ?? null;
    return t ? new Date(t).getTime() : 0;
  };
  for (const l of locations) {
    const current = out.get(l.technician_id);
    if (!current || timeOf(l) > timeOf(current)) out.set(l.technician_id, l);
  }
  return out;
}

export function suggestAssignee(args: {
  tradeId: TradeId;
  customerId?: string | null;
  siteId?: string | null;
  siteLatLng?: { lat: number; lng: number } | null;
  jobCards: JobCard[];
  technicians: Technician[];
  technicianLocations?: TechnicianLocation[];
}): AssigneeSuggestion | null {
  const active = args.technicians.filter((t) => t.active);
  if (active.length === 0) return null;

  const tradeMatched = active.filter((t) => (t.trades ?? []).includes(args.tradeId));
  const candidates = tradeMatched.length > 0 ? tradeMatched : active;
  const candidateIds = new Set(candidates.map((t) => t.id));

  const tradeJobs = args.jobCards.filter((j) => j.trade_id === args.tradeId);

  if (args.siteId) {
    const siteJobs = tradeJobs.filter((j) => j.site_id === args.siteId && j.status !== "cancelled");
    const techId = pickMostRecentAssignedTechId(siteJobs, candidateIds);
    if (techId) return { technicianId: techId, reason: "Last assigned at this site" };
  }

  if (args.customerId) {
    const custJobs = tradeJobs.filter((j) => j.customer_id === args.customerId && j.status !== "cancelled");
    const techId = pickMostRecentAssignedTechId(custJobs, candidateIds);
    if (techId) return { technicianId: techId, reason: "Often assigned for this customer" };
  }

  if (args.siteLatLng && args.technicianLocations && args.technicianLocations.length > 0) {
    const latest = latestLocationByTechId(args.technicianLocations);
    let best: { technicianId: string; distance: number } | null = null;
    for (const t of candidates) {
      const loc = latest.get(t.id);
      if (!loc) continue;
      const d = distanceMeters(args.siteLatLng, { lat: loc.latitude, lng: loc.longitude });
      if (!Number.isFinite(d)) continue;
      if (!best || d < best.distance) best = { technicianId: t.id, distance: d };
    }
    if (best) return { technicianId: best.technicianId, reason: "Nearest to this site", distanceMeters: best.distance };
  }

  return { technicianId: candidates[0].id, reason: "Suggested technician" };
}
