import DashboardShell from "@/features/dashboard/components/dashboard-shell";
import { DashboardDataProvider } from "@/features/dashboard/store/dashboard-data-store";
import { RequireAuth } from "@/features/auth/hooks/use-auth";
import { Outlet } from "react-router-dom";

export default function Dashboard() {
  return (
    <RequireAuth allowedRoles={["owner", "admin", "office_staff"]}>
      <DashboardDataProvider>
        <DashboardShell>
          <Outlet />
        </DashboardShell>
      </DashboardDataProvider>
    </RequireAuth>
  );
}
