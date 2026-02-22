import DashboardShell from "@/features/dashboard/components/dashboard-shell";
import { DashboardDataProvider } from "@/features/dashboard/store/dashboard-data-store";
import { RequireAuth } from "@/features/auth/hooks/use-auth";
import { OnboardingOverlay } from "@/features/onboarding/OnboardingOverlay";
import { OnboardingProvider } from "@/features/onboarding/OnboardingProvider";
import { Outlet } from "react-router-dom";

export default function Dashboard() {
  return (
    <RequireAuth allowedRoles={["owner", "admin", "office_staff"]}>
      <DashboardDataProvider>
        <OnboardingProvider>
          <DashboardShell>
            <OnboardingOverlay />
            <Outlet />
          </DashboardShell>
        </OnboardingProvider>
      </DashboardDataProvider>
    </RequireAuth>
  );
}
