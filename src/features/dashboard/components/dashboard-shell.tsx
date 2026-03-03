import { SidebarInset, SidebarProvider, SidebarRail } from "@/components/ui/sidebar";
import DashboardSidebar from "@/features/dashboard/components/dashboard-sidebar";
import DashboardTopbar from "@/features/dashboard/components/dashboard-topbar";
import CompleteProfileDialog from "@/features/dashboard/components/complete-profile-dialog";
import ProfileCompletionBanner from "@/features/dashboard/components/profile-completion-banner";
import CompanyComplianceWizardDialog from "@/features/dashboard/components/company-compliance-wizard-dialog";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import * as React from "react";
import { useLocation } from "react-router-dom";
import NoCompanyStateCard from "@/features/dashboard/components/no-company-state-card";
import PageHeader from "@/features/dashboard/components/page-header";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTrialStatus, shouldShowTrialWarning } from "@/features/trial/hooks/use-trial-status";
import TrialBanner from "@/features/trial/components/trial-banner";
import TrialPaywall from "@/features/trial/components/trial-paywall";
import { useTrialBannerDismissal } from "@/features/trial/hooks/use-trial-banner-dismissal";
import { AiAssistFab } from "@/features/ai/components/ai-assist-fab";
import { AiAssistSheet } from "@/features/ai/components/ai-assist-sheet";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data, companyState, actions } = useDashboardData();
  const { roles, refreshProfile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const company = data.company as any;
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [complianceOpen, setComplianceOpen] = React.useState(false);
  const canCreateCompany = roles.includes("owner") || roles.includes("admin");
  const trialStatus = useTrialStatus(company);

  const retryLink = React.useCallback(async () => {
    await refreshProfile();
    await actions.refreshData({ silent: true });
  }, [actions, refreshProfile]);

  const isCreateCompanyRoute = location.pathname.startsWith("/dashboard/create-company");
  const isHomeRoute = location.pathname === "/dashboard";

  const shouldGate = !isHomeRoute && !isCreateCompanyRoute && companyState.kind !== "ok";

  // Auto-open the dialog once if the company profile isn't marked complete
  const shownRef = React.useRef(false);
  React.useEffect(() => {
    if (!company?.id) return;
    if (shownRef.current) return;
    if (!company.profile_complete) {
      shownRef.current = true;
      // Small delay so the dashboard loads first
      const id = window.setTimeout(() => setDialogOpen(true), 1200);
      return () => window.clearTimeout(id);
    }
  }, [company?.id, company?.profile_complete]);

  const showProfileBanner = Boolean(company?.id && !company.profile_complete);
  const trialDismissal = useTrialBannerDismissal({
    companyId: company?.id ?? null,
    endsAt: trialStatus.state === "trialing" ? trialStatus.endsAt : null,
  });
  const showTrialBanner = shouldShowTrialWarning(trialStatus) && !trialDismissal.dismissed;

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarRail />
      <SidebarInset>
        <DashboardTopbar onOpenCompliance={() => setComplianceOpen(true)} />
        {showProfileBanner ? <ProfileCompletionBanner onOpen={() => setDialogOpen(true)} /> : null}
        {showTrialBanner ? <TrialBanner status={trialStatus} dismissible onDismiss={trialDismissal.dismiss} /> : null}
        <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6">
          {trialStatus.state === "expired" ? (
            <TrialPaywall />
          ) : shouldGate ? (
            <div className="space-y-6">
              <PageHeader title="Workspace" subtitle="This page requires an active company workspace." />
              {companyState.kind === "error" ? (
                <NoCompanyStateCard
                  title="Workspace unavailable"
                  description={companyState.message ?? "We couldn't load your workspace. Try again."}
                  canCreateCompany={false}
                  onRetryLink={() => void retryLink()}
                />
              ) : companyState.kind === "missing" ? (
                <NoCompanyStateCard
                  title="Company not found"
                  description="Your account is linked to a company that no longer exists (or was deleted). Create a new company to continue."
                  canCreateCompany={canCreateCompany}
                  onRetryLink={() => void retryLink()}
                />
              ) : (
                <NoCompanyStateCard
                  title={canCreateCompany ? "No company yet" : "Not linked to a company"}
                  description={
                    canCreateCompany
                      ? "Create your company to unlock job cards, inventory, teams, and sites."
                      : "This account isn't linked to a company yet. Ask an admin/owner to link you, then retry."
                  }
                  canCreateCompany={canCreateCompany}
                  onRetryLink={() => void retryLink()}
                />
              )}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => void signOut().finally(() => navigate("/login"))}
                >
                  Sign out
                </Button>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </SidebarInset>
      <CompleteProfileDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <CompanyComplianceWizardDialog
        open={complianceOpen}
        onOpenChange={setComplianceOpen}
        company={company}
        canEdit={canCreateCompany}
      />
      <AiAssistSheet />
      <AiAssistFab />
    </SidebarProvider>
  );
}
