import { SidebarInset, SidebarProvider, SidebarRail } from "@/components/ui/sidebar";
import DashboardSidebar from "@/features/dashboard/components/dashboard-sidebar";
import DashboardTopbar from "@/features/dashboard/components/dashboard-topbar";
import CompleteProfileDialog from "@/features/dashboard/components/complete-profile-dialog";
import ProfileCompletionBanner from "@/features/dashboard/components/profile-completion-banner";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import * as React from "react";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data } = useDashboardData();
  const company = data.company as any;
  const [dialogOpen, setDialogOpen] = React.useState(false);

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

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarRail />
      <SidebarInset>
        <DashboardTopbar />
        {company?.id && !company.profile_complete && (
          <ProfileCompletionBanner onOpen={() => setDialogOpen(true)} />
        )}
        <div className="container mx-auto px-4 py-6">{children}</div>
      </SidebarInset>
      <CompleteProfileDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </SidebarProvider>
  );
}
