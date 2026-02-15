import TechShell from "@/features/technician/components/tech-shell";
import { RequireAuth } from "@/features/auth/hooks/use-auth";
import { Outlet } from "react-router-dom";

export default function TechDashboard() {
  return (
    <RequireAuth>
      <TechShell>
        <Outlet />
      </TechShell>
    </RequireAuth>
  );
}
