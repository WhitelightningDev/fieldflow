export type PlanTier = "starter" | "pro" | "business";

export type PlanFeatureKey =
  | "job_cards"
  | "scheduling"
  | "basic_inventory"
  | "mobile_app"
  | "invoicing"
  | "customer_portal"
  | "quote_requests"
  | "priority_support"
  | "ai_job_summaries"
  | "accounting_integrations"
  | "api_webhook_access"
  | "dedicated_support";

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  basePriceCents: number;
  perTechPriceCents: number;
  includedTechs: number;
  maxTechs: number | null; // null = unlimited
  features: PlanFeatureKey[];
  featureLabels: string[];
  popular: boolean;
}

export const PLANS: PlanDefinition[] = [
  {
    tier: "starter",
    name: "Starter",
    basePriceCents: 49900,
    perTechPriceCents: 14900,
    includedTechs: 1,
    maxTechs: 5,
    // Starter: 1 tech included in base price
    features: ["job_cards", "scheduling", "basic_inventory", "mobile_app"],
    featureLabels: [
      "1 technician included",
      "Job cards & scheduling",
      "Basic inventory",
      "Mobile technician app",
    ],
    popular: false,
  },
  {
    tier: "pro",
    name: "Pro",
    basePriceCents: 99900,
    perTechPriceCents: 12900,
    includedTechs: 2,
    maxTechs: 25,
    features: [
      "job_cards",
      "scheduling",
      "basic_inventory",
      "mobile_app",
      "invoicing",
      "customer_portal",
      "priority_support",
    ],
    featureLabels: [
      "2 technicians included",
      "All Starter features",
      "Invoicing & payments",
      "Customer portal",
      "Priority support",
    ],
    popular: true,
  },
  {
    tier: "business",
    name: "Business",
    basePriceCents: 199900,
    perTechPriceCents: 9900,
    includedTechs: 2,
    maxTechs: null,
    features: [
      "job_cards",
      "scheduling",
      "basic_inventory",
      "mobile_app",
      "invoicing",
      "customer_portal",
      "quote_requests",
      "priority_support",
      "ai_job_summaries",
      "accounting_integrations",
      "api_webhook_access",
      "dedicated_support",
    ],
    featureLabels: [
      "2 technicians included",
      "All Pro features",
      "Quote requests + QR form",
      "AI job summaries",
      "Accounting integrations",
      "API & webhook access",
      "Dedicated support",
    ],
    popular: false,
  },
];

export function getPlan(tier: PlanTier): PlanDefinition {
  return PLANS.find((p) => p.tier === tier) ?? PLANS[0];
}

export function formatZar(cents: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export function calculateMonthlyTotal(
  tier: PlanTier,
  techCount: number,
): { base: number; extraTechsCost: number; total: number; extraTechs: number } {
  const plan = getPlan(tier);
  const extraTechs = Math.max(0, techCount - plan.includedTechs);
  const extraTechsCost = extraTechs * plan.perTechPriceCents;
  return {
    base: plan.basePriceCents,
    extraTechsCost,
    total: plan.basePriceCents + extraTechsCost,
    extraTechs,
  };
}
