import * as React from "react";
import type { OnboardingController, OnboardingManager } from "@/features/onboarding/types";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { useOnboarding } from "@/features/onboarding/useOnboarding";
import { PLUMBER_DASHBOARD_TUTORIAL_KEY, plumberDashboardTutorialSteps } from "@/features/onboarding/tutorials/plumberDashboardTutorial";
import { CREATE_CUSTOMER_TUTORIAL_KEY, createCustomerTutorialSteps } from "@/features/onboarding/tutorials/createCustomerTutorial";
import { CREATE_SITE_TUTORIAL_KEY, createSiteTutorialSteps } from "@/features/onboarding/tutorials/createSiteTutorial";
import { ADD_TECHNICIAN_TUTORIAL_KEY, addTechnicianTutorialSteps } from "@/features/onboarding/tutorials/addTechnicianTutorial";
import { useLocation } from "react-router-dom";

const OnboardingContext = React.createContext<OnboardingManager | null>(null);

export function useOnboardingController() {
  return React.useContext(OnboardingContext)?.active ?? null;
}

export function useOnboardingManager() {
  return React.useContext(OnboardingContext);
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const { data, companyState } = useDashboardData();
  const location = useLocation();

  const companyId = profile?.company_id ?? (data.company as any)?.id ?? null;
  const industry = (data.company as any)?.industry as string | null | undefined;

  const canRun = companyState.kind === "ok" && Boolean(companyId) && Boolean(user?.id);

  const sidebarTourEnabled = canRun && industry === "plumbing" && location.pathname.startsWith("/dashboard");
  const createCustomerEnabled = canRun && location.pathname.startsWith("/dashboard/customers");
  const createSiteEnabled = canRun && location.pathname.startsWith("/dashboard/sites");
  const addTechnicianEnabled = canRun && location.pathname.startsWith("/dashboard/technicians");

  const sidebarController = useOnboarding({
    userId: user?.id,
    companyId,
    tutorialKey: sidebarTourEnabled ? PLUMBER_DASHBOARD_TUTORIAL_KEY : null,
    steps: sidebarTourEnabled ? plumberDashboardTutorialSteps : [],
  });

  const createCustomerController = useOnboarding({
    userId: user?.id,
    companyId,
    tutorialKey: createCustomerEnabled ? CREATE_CUSTOMER_TUTORIAL_KEY : null,
    steps: createCustomerEnabled ? createCustomerTutorialSteps : [],
  });

  const createSiteController = useOnboarding({
    userId: user?.id,
    companyId,
    tutorialKey: createSiteEnabled ? CREATE_SITE_TUTORIAL_KEY : null,
    steps: createSiteEnabled ? createSiteTutorialSteps : [],
  });

  const addTechnicianController = useOnboarding({
    userId: user?.id,
    companyId,
    tutorialKey: addTechnicianEnabled ? ADD_TECHNICIAN_TUTORIAL_KEY : null,
    steps: addTechnicianEnabled ? addTechnicianTutorialSteps : [],
  });

  const controllers = React.useMemo<Record<string, OnboardingController>>(
    () => ({
      [PLUMBER_DASHBOARD_TUTORIAL_KEY]: sidebarController,
      [CREATE_CUSTOMER_TUTORIAL_KEY]: createCustomerController,
      [CREATE_SITE_TUTORIAL_KEY]: createSiteController,
      [ADD_TECHNICIAN_TUTORIAL_KEY]: addTechnicianController,
    }),
    [sidebarController, createCustomerController, createSiteController, addTechnicianController],
  );

  const priority = React.useMemo(
    () => [
      PLUMBER_DASHBOARD_TUTORIAL_KEY,
      CREATE_CUSTOMER_TUTORIAL_KEY,
      CREATE_SITE_TUTORIAL_KEY,
      ADD_TECHNICIAN_TUTORIAL_KEY,
    ],
    [],
  );

  const [activeTutorialKey, setActiveTutorialKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (activeTutorialKey) {
      const current = controllers[activeTutorialKey];
      if (current?.isOpen) return;
    }

    const nextKey = priority.find((k) => controllers[k]?.isOpen) ?? null;
    setActiveTutorialKey(nextKey);
  }, [activeTutorialKey, controllers, priority]);

  const active = activeTutorialKey ? controllers[activeTutorialKey] ?? null : null;

  const replay = React.useCallback(
    (tutorialKey: string) => {
      const c = controllers[tutorialKey];
      c?.actions.replay();
      setActiveTutorialKey(tutorialKey);
    },
    [controllers],
  );

  const value: OnboardingManager = React.useMemo(
    () => ({
      active,
      controllers,
      setActiveTutorialKey,
      replay,
    }),
    [active, controllers, replay],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}
