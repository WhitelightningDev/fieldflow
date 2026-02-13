import { SidebarInset, SidebarProvider, SidebarRail } from "@/components/ui/sidebar";
import DashboardSidebar from "@/features/dashboard/components/dashboard-sidebar";
import DashboardTopbar from "@/features/dashboard/components/dashboard-topbar";
import * as React from "react";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarRail />
      <SidebarInset>
        <DashboardTopbar />
        <div className="container mx-auto px-4 py-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

