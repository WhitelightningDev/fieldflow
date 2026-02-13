import DashboardShell from "@/features/dashboard/components/dashboard-shell";
import { DashboardDataProvider } from "@/features/dashboard/store/dashboard-data-store";
import { Outlet } from "react-router-dom";

export default function Dashboard() {
  return (
    <DashboardDataProvider>
      <DashboardShell>
        <Outlet />
      </DashboardShell>
    </DashboardDataProvider>
  );
}

