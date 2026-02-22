import * as React from "react";
import type { OnboardingController } from "@/features/onboarding/types";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { useOnboarding } from "@/features/onboarding/useOnboarding";
import { PLUMBER_DASHBOARD_TUTORIAL_KEY, plumberDashboardTutorialSteps } from "@/features/onboarding/tutorials/plumberDashboardTutorial";

const OnboardingContext = React.createContext<OnboardingController | null>(null);

export function useOnboardingController() {
  return React.useContext(OnboardingContext);
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const { data, companyState } = useDashboardData();

  const companyId = profile?.company_id ?? (data.company as any)?.id ?? null;
  const industry = (data.company as any)?.industry as string | null | undefined;

  const tutorial =
    companyState.kind === "ok" && industry === "plumbing"
      ? { tutorialKey: PLUMBER_DASHBOARD_TUTORIAL_KEY, steps: plumberDashboardTutorialSteps }
      : { tutorialKey: null, steps: [] };

  const controller = useOnboarding({
    userId: user?.id,
    companyId,
    tutorialKey: tutorial.tutorialKey,
    steps: tutorial.steps,
  });

  return <OnboardingContext.Provider value={controller}>{children}</OnboardingContext.Provider>;
}

