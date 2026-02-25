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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { getIndustryNav } from "@/features/dashboard/constants/industry-nav";
import { cn } from "@/lib/utils";
import { LogOut, Building2, ChevronDown, Folder, Sparkles, MessageSquare, Settings, Lock } from "lucide-react";
import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BrandIcon, BrandWordmark } from "@/components/brand/brand-mark";
import ComplianceStatusIcon from "@/features/compliance/components/compliance-status-icon";
import { useFeatureGate } from "@/features/subscription/hooks/use-feature-gate";
import { Badge } from "@/components/ui/badge";

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

type NavGroupKey = "operations" | "industry" | "communication" | "admin";

function groupForNavItem(to: string): NavGroupKey {
  if (to === "/dashboard/settings") return "admin";
  if (to === "/dashboard/ai") return "admin";
  if (to === "/dashboard/messages") return "communication";
  if (
    to === "/dashboard/sites" ||
    to === "/dashboard/customers" ||
    to === "/dashboard/technicians" ||
    to === "/dashboard/teams" ||
    to === "/dashboard/inventory"
  ) {
    return "operations";
  }
  return "industry";
}

export default function DashboardSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, roles } = useAuth();
  const { data } = useDashboardData();
  const company = data.company as any;
  const gate = useFeatureGate(company?.subscription_tier);
  const canUseAi = React.useMemo(() => {
    const allowed = new Set(["owner", "admin", "office_staff"]);
    return (roles ?? []).some((r) => allowed.has(String(r)));
  }, [roles]);

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

  const { primaryNav, groupedNav } = React.useMemo(() => {
    const primarySet = new Set(["/dashboard", "/dashboard/jobs", "/dashboard/invoices"]);
    const primaryNav = navItems.filter((item) => primarySet.has(item.to));
    const rest = navItems.filter((item) => !primarySet.has(item.to));

    const grouped = rest.reduce<Record<NavGroupKey, typeof navItems>>(
      (acc, item) => {
        acc[groupForNavItem(item.to)].push(item);
        return acc;
      },
      { operations: [], industry: [], communication: [], admin: [] },
    );

    const groupedNav = [
      { key: "operations" as const, label: "Operations", icon: Folder, items: grouped.operations },
      { key: "industry" as const, label: "Industry", icon: Sparkles, items: grouped.industry },
      { key: "communication" as const, label: "Communication", icon: MessageSquare, items: grouped.communication },
      { key: "admin" as const, label: "Admin", icon: Settings, items: grouped.admin },
    ].filter((g) => g.items.length > 0);

    return { primaryNav, groupedNav };
  }, [navItems]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate("/login");
    }
  };

  const renderNavLink = (item: typeof navItems[0]) => {
    const allowedByPlan = gate.isRouteAllowed(item.to);
    const allowedByRole = item.to === "/dashboard/ai" ? canUseAi : true;
    const allowed = allowedByPlan && allowedByRole;
    return (
      <Link
        to={allowed ? item.to : "#"}
        data-tour={tourIdForNavPath(item.to)}
        className={cn("flex items-center gap-2", !allowed && "opacity-50 pointer-events-none")}
        onClick={(e) => {
          if (!allowed) e.preventDefault();
        }}
      >
        <item.icon />
        <span>{item.label}</span>
        {!allowed && <Lock className="h-3 w-3 ml-auto text-muted-foreground" />}
      </Link>
    );
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
          {company?.id ? <ComplianceStatusIcon company={company} className="ml-auto shrink-0" /> : null}
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
          {company?.id ? <ComplianceStatusIcon company={company} className="ml-auto shrink-0" /> : null}
        </Link>
      )}
      {company?.subscription_tier && (
        <div className="px-2 pb-1">
          <Badge variant="secondary" className="text-xs capitalize">{company.subscription_tier} plan</Badge>
        </div>
      )}
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryNav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.label}>
                    {renderNavLink(item)}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {groupedNav.map((group) => {
                const anyActive = group.items.some((item) => isActive(item.to));
                const GroupIcon = group.icon;

                return (
                  <Collapsible key={group.key} asChild defaultOpen={anyActive || group.key === "operations"}>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton isActive={anyActive} tooltip={group.label} className="gap-2">
                          <GroupIcon />
                          <span>{group.label}</span>
                          <ChevronDown className="ml-auto size-4 transition-transform data-[state=open]:rotate-180" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {group.items.map((item) => (
                            <SidebarMenuSubItem key={item.to}>
                              <SidebarMenuSubButton asChild isActive={isActive(item.to)}>
                                {renderNavLink(item)}
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
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
            {company?.id ? <ComplianceStatusIcon company={company} className="ml-auto shrink-0" /> : null}
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
