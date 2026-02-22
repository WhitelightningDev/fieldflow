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
import { LogOut, Building2 } from "lucide-react";
import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BrandIcon, BrandWordmark } from "@/components/brand/brand-mark";

function tourIdForNavPath(to: string) {
  if (to === "/dashboard") return "nav-overview";
  const suffix = to.replace("/dashboard/", "");
  // Keep ids stable and selector-friendly.
  const cleaned = suffix
    .replace(/[^a-z0-9-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `nav-${cleaned}`;
}

export default function DashboardSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data } = useDashboardData();
  const company = data.company as any;

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
      {/* Company branding — text hidden when collapsed via overflow-hidden on the group */}
      {company?.logo_url ? (
        <Link to="/" className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-sidebar-accent overflow-hidden">
          <img
            src={company.logo_url}
            alt={company.name}
            className="h-8 w-8 rounded-md object-contain shrink-0"
          />
          <span className="text-sm font-semibold leading-tight truncate min-w-0">
            {company.name}
          </span>
        </Link>
      ) : (
        <Link to="/" className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-sidebar-accent overflow-hidden">
          <BrandIcon size={32} />
          <span className="min-w-0">
            <BrandWordmark className="text-base font-semibold leading-tight" />
            {company?.name && (
              <span className="block text-xs text-muted-foreground truncate">
                {company.name}
              </span>
            )}
          </span>
        </Link>
      )}
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
                    <Link
                      to={item.to}
                      data-tour={tourIdForNavPath(item.to)}
                      className={cn("flex items-center gap-2")}
                    >
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
        {/* Mini company info strip at the bottom */}
        {company?.name && (
          <div className="px-3 py-2 flex items-center gap-2 text-xs text-sidebar-foreground/60 border-t border-sidebar-border overflow-hidden">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate min-w-0">{company.name}</span>
          </div>
        )}
        <Button
          variant="ghost"
          className="justify-start text-sidebar-foreground/80 hover:text-sidebar-accent-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          <span>Sign out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
