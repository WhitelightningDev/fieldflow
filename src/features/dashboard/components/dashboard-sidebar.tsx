import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { getIndustryNav } from "@/features/dashboard/constants/industry-nav";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

export default function DashboardSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data } = useDashboardData();

  const navItems = React.useMemo(
    () => getIndustryNav(data.company?.industry),
    [data.company?.industry],
  );
  const isActive = React.useCallback(
    (to: string) => {
      if (to === "/dashboard") return location.pathname === "/dashboard";
      return location.pathname.startsWith(to);
    },
    [location.pathname],
  );

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate("/login");
    }
  };

  return (
    <Sidebar collapsible="icon" variant="inset" className="border-sidebar-border">
      <SidebarHeader className="px-2">
        <Link to="/" className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-sidebar-accent">
          <div className="w-8 h-8 gradient-bg rounded-lg flex items-center justify-center shadow-glow">
            <span className="text-primary-foreground font-bold text-base">F</span>
          </div>
          <div className="font-semibold leading-tight">
            Field<span className="gradient-text">Flow</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.label}>
                    <Link to={item.to} className={cn("flex items-center gap-2")}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Button variant="ghost" className="justify-start text-sidebar-foreground/80 hover:text-sidebar-accent-foreground" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" />
          <span>Sign out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
