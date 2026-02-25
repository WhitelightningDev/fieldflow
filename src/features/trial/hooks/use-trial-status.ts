import { useMemo } from "react";

export type TrialStatus =
  | { state: "trialing"; daysLeft: number; endsAt: Date }
  | { state: "expired" }
  | { state: "active" }
  | { state: "unknown" };

export function useTrialStatus(company: any): TrialStatus {
  return useMemo(() => {
    if (!company) return { state: "unknown" };

    const subStatus = company.subscription_status as string | undefined;

    if (subStatus === "active" || subStatus === "paid") {
      return { state: "active" };
    }

    const endsAtRaw = company.trial_ends_at as string | undefined;
    if (!endsAtRaw) return { state: "unknown" };

    const endsAt = new Date(endsAtRaw);
    const now = new Date();
    const diffMs = endsAt.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    if (daysLeft <= 0) return { state: "expired" };

    return { state: "trialing", daysLeft, endsAt };
  }, [company?.subscription_status, company?.trial_ends_at]);
}

/** Show the trial banner when 5 or fewer days remain */
export function shouldShowTrialWarning(status: TrialStatus): boolean {
  return status.state === "trialing" && status.daysLeft <= 5;
}
