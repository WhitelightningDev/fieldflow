import { useMemo } from "react";
import { type PlanTier, type PlanFeatureKey, getPlan } from "@/features/subscription/plans";

export function useFeatureGate(tier: PlanTier | undefined | null) {
  return useMemo(() => {
    const resolvedTier = tier || "starter";
    const plan = getPlan(resolvedTier as PlanTier);
    const features = new Set(plan.features);

    return {
      tier: resolvedTier as PlanTier,
      plan,
      hasFeature: (key: PlanFeatureKey) => features.has(key),
      /** Route-level gates */
      isRouteAllowed: (path: string): boolean => {
        // AI Assistant requires Business (feature: ai_job_summaries)
        if (path.startsWith("/dashboard/ai") && !features.has("ai_job_summaries")) return false;
        // Quote Requests requires Business (feature: quote_requests)
        if (path.startsWith("/dashboard/quotes") && !features.has("quote_requests")) return false;
        // Invoicing requires pro+
        if (path.includes("/invoices") && !features.has("invoicing")) return false;
        // Messages/customer portal requires pro+
        if (path.includes("/messages") && !features.has("customer_portal")) return false;
        return true;
      },
    };
  }, [tier]);
}
