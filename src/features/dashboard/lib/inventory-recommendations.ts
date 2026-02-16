import type { TradeId } from "@/features/company-signup/content/trades";
import type { Database, Tables } from "@/integrations/supabase/types";

type InventoryUnit = Database["public"]["Enums"]["inventory_unit"];
type InventoryItem = Tables<"inventory_items">;

export type InventoryRecommendation = {
  name: string;
  unit: InventoryUnit;
  reorderPoint: number;
  perishable: boolean;
  reason: string;
  location?: string;
  sku?: string;
};

type Candidate = Omit<InventoryRecommendation, "reason"> & {
  id: string;
  baseScore: number;
  triggers: Array<{ keywords: string[]; score: number; reason: string }>;
};

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function includesKeyword(haystack: string, keyword: string) {
  const k = normalize(keyword);
  if (!k) return false;
  return haystack.includes(k);
}

function scoreCandidate(candidate: Candidate, context: { itemName: string }) {
  let score = candidate.baseScore;
  let reason = "Common electrical essential.";

  const normalized = normalize(context.itemName);
  if (!normalized) return { score, reason };

  for (const trigger of candidate.triggers) {
    if (trigger.keywords.some((kw) => includesKeyword(normalized, kw))) {
      score += trigger.score;
      reason = trigger.reason;
    }
  }

  return { score, reason };
}

function getExistingNames(items: InventoryItem[], tradeId: TradeId) {
  const out = new Set<string>();
  for (const i of items) {
    if (!i?.name) continue;
    if (i.trade_id !== tradeId) continue;
    out.add(normalize(i.name));
  }
  return out;
}

const ELECTRICAL_CANDIDATES: Candidate[] = [
  {
    id: "insulation-tape",
    name: "Insulation tape",
    unit: "each",
    reorderPoint: 8,
    perishable: false,
    baseScore: 40,
    triggers: [
      { keywords: ["cable", "wire", "twin", "earth"], score: 35, reason: "Useful for cable terminations and quick insulation fixes." },
      { keywords: ["junction", "box", "db", "distribution"], score: 25, reason: "Handy for sealing and insulating terminations inside enclosures." },
    ],
  },
  {
    id: "heat-shrink",
    name: "Heat shrink (assorted)",
    unit: "box",
    reorderPoint: 3,
    perishable: false,
    baseScore: 35,
    triggers: [
      { keywords: ["cable", "wire", "lug", "ferrule"], score: 45, reason: "Often needed to finish and protect cable lugs/ferrules." },
      { keywords: ["solar", "pv", "panel"], score: 30, reason: "Helps weatherproof exposed cable joints on PV installs." },
    ],
  },
  {
    id: "cable-ties",
    name: "Cable ties (pack)",
    unit: "box",
    reorderPoint: 3,
    perishable: false,
    baseScore: 45,
    triggers: [
      { keywords: ["cable", "wire", "conduit", "trunking"], score: 35, reason: "Cable management: usually needed with cable runs." },
      { keywords: ["solar", "pv", "panel"], score: 25, reason: "Helps secure PV wiring and tidy up roof runs." },
    ],
  },
  {
    id: "wago-connectors",
    name: "Lever connectors (WAGO-style, assorted)",
    unit: "box",
    reorderPoint: 3,
    perishable: false,
    baseScore: 30,
    triggers: [
      { keywords: ["junction", "box", "light", "socket"], score: 55, reason: "Common for fast, reliable joins in junction/lighting circuits." },
      { keywords: ["cable", "wire"], score: 35, reason: "Great for splicing/terminating conductors quickly and safely." },
    ],
  },
  {
    id: "ferrules",
    name: "Ferrules (assorted)",
    unit: "box",
    reorderPoint: 2,
    perishable: false,
    baseScore: 25,
    triggers: [
      { keywords: ["db", "distribution", "panel", "inverter"], score: 60, reason: "Often required for neat, compliant terminations in panels/inverters." },
      { keywords: ["cable", "wire"], score: 35, reason: "Improves termination quality for stranded conductors." },
    ],
  },
  {
    id: "lugs",
    name: "Cable lugs (assorted)",
    unit: "box",
    reorderPoint: 2,
    perishable: false,
    baseScore: 25,
    triggers: [
      { keywords: ["earth", "battery", "inverter"], score: 60, reason: "Commonly needed for earth/battery/inverter terminations." },
      { keywords: ["cable", "wire"], score: 35, reason: "Useful for secure high-current connections." },
    ],
  },
  {
    id: "cable-glands",
    name: "Cable glands (assorted)",
    unit: "box",
    reorderPoint: 2,
    perishable: false,
    baseScore: 28,
    triggers: [
      { keywords: ["db", "distribution", "panel", "enclosure"], score: 55, reason: "Needed to safely bring cables into DBs/enclosures (strain relief)." },
      { keywords: ["solar", "pv", "panel"], score: 35, reason: "Helps weather-seal PV cable entries." },
    ],
  },
  {
    id: "din-rail",
    name: "DIN rail (1m)",
    unit: "each",
    reorderPoint: 6,
    perishable: false,
    baseScore: 18,
    triggers: [
      { keywords: ["db", "distribution", "breaker", "rcd"], score: 70, reason: "Often required when fitting breakers/RCBOs and accessories in DBs." },
    ],
  },
  {
    id: "trunking",
    name: "PVC trunking (2m, assorted sizes)",
    unit: "each",
    reorderPoint: 10,
    perishable: false,
    baseScore: 20,
    triggers: [
      { keywords: ["cable", "wire", "twin", "earth"], score: 40, reason: "Cable runs usually need trunking/conduit for protection and neatness." },
      { keywords: ["office", "board", "db"], score: 20, reason: "Helps route and protect wiring near DBs and terminations." },
    ],
  },
  {
    id: "conduit",
    name: "Conduit (20mm, 3m lengths)",
    unit: "each",
    reorderPoint: 12,
    perishable: false,
    baseScore: 20,
    triggers: [
      { keywords: ["cable", "wire", "run"], score: 35, reason: "Protects cables on long runs (especially surface installs)." },
      { keywords: ["outdoor", "solar", "pv"], score: 25, reason: "Helps protect wiring in exposed areas." },
    ],
  },
  {
    id: "junction-boxes",
    name: "Junction boxes",
    unit: "each",
    reorderPoint: 10,
    perishable: false,
    baseScore: 25,
    triggers: [
      { keywords: ["cable", "wire", "splice"], score: 40, reason: "Often needed to terminate and protect joins." },
      { keywords: ["light", "socket", "switch"], score: 35, reason: "Common requirement for circuit junctions." },
    ],
  },
  {
    id: "screws-anchors",
    name: "Screws & wall plugs (assorted)",
    unit: "box",
    reorderPoint: 3,
    perishable: false,
    baseScore: 22,
    triggers: [
      { keywords: ["trunking", "conduit", "db", "enclosure"], score: 50, reason: "Mounting hardware is usually needed for conduit/trunking/DB installs." },
      { keywords: ["panel", "solar"], score: 30, reason: "Useful for mounting ancillary hardware (not structural PV rails)." },
    ],
  },
  {
    id: "labels",
    name: "Circuit labels / marker tape",
    unit: "each",
    reorderPoint: 5,
    perishable: false,
    baseScore: 18,
    triggers: [
      { keywords: ["db", "distribution", "panel", "breaker"], score: 60, reason: "Labeling circuits is a common compliance and handover requirement." },
      { keywords: ["solar", "pv", "inverter"], score: 40, reason: "PV installs often require labels for isolators and circuits." },
    ],
  },
  {
    id: "mc4-connectors",
    name: "MC4 connectors (pair)",
    unit: "each",
    reorderPoint: 10,
    perishable: false,
    baseScore: 10,
    triggers: [{ keywords: ["solar", "pv", "panel"], score: 90, reason: "Typically needed for PV panel string connections." }],
  },
  {
    id: "pv-cable",
    name: "PV cable (4mm/6mm, black/red)",
    unit: "meter",
    reorderPoint: 50,
    perishable: false,
    baseScore: 10,
    triggers: [{ keywords: ["solar", "pv", "panel", "inverter"], score: 80, reason: "Core consumable for PV strings and inverter connections." }],
  },
  {
    id: "dc-isolator",
    name: "DC isolator",
    unit: "each",
    reorderPoint: 2,
    perishable: false,
    baseScore: 8,
    triggers: [{ keywords: ["solar", "pv", "inverter"], score: 85, reason: "Commonly required for PV compliance and safe maintenance." }],
  },
];

export function getInventoryRecommendations(args: {
  tradeId: TradeId;
  itemName?: string;
  existingItems?: InventoryItem[];
  max?: number;
}): InventoryRecommendation[] {
  const tradeId = args.tradeId;
  const max = Math.max(1, Math.min(args.max ?? 6, 12));
  const existingItems = args.existingItems ?? [];
  const existing = getExistingNames(existingItems, tradeId);
  const contextName = (args.itemName ?? "").trim();
  const contextNorm = normalize(contextName);

  if (tradeId !== "electrical-contracting") return [];

  const scored = ELECTRICAL_CANDIDATES.map((c) => {
    const { score, reason } = scoreCandidate(c, { itemName: contextName });
    return { c, score, reason };
  })
    .filter(({ c }) => !existing.has(normalize(c.name)))
    .filter(({ c }) => (contextNorm ? normalize(c.name) !== contextNorm : true))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, max).map(({ c, reason }) => ({
    name: c.name,
    unit: c.unit,
    reorderPoint: c.reorderPoint,
    perishable: c.perishable,
    location: c.location,
    sku: c.sku,
    reason,
  }));
}

