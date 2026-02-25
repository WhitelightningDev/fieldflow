import { getTechIndustryNav } from "@/features/technician/constants/tech-industry-nav";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Link, NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/notification-bell";
import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandIcon, BrandWordmark } from "@/components/brand/brand-mark";
import TrialDaysIconButton from "@/features/trial/components/trial-days-icon-button";

export default function TechSidebar({
  onNavigate,
  trialDaysLeft,
  showTrialDaysIcon,
  onRestoreTrialBanner,
}: {
  onNavigate?: () => void;
  trialDaysLeft?: number;
  showTrialDaysIcon?: boolean;
  onRestoreTrialBanner?: () => void;
}) {
  const { profile, signOut, user } = useAuth();
  const location = useLocation();
  const [industry, setIndustry] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!profile?.company_id) return;
    supabase
      .from("companies")
      .select("industry")
      .eq("id", profile.company_id)
      .single()
      .then(({ data }) => {
        if (data) setIndustry(data.industry);
      });
  }, [profile?.company_id]);

  const navItems = getTechIndustryNav(industry);

  return (
    <aside className="flex flex-col h-full w-64 border-r border-border bg-card">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 min-w-0" onClick={() => onNavigate?.()}>
            <BrandIcon size={28} />
            <BrandWordmark className="text-lg" />
          </Link>
          <div className="flex items-center gap-1">
            {showTrialDaysIcon && typeof trialDaysLeft === "number" && onRestoreTrialBanner ? (
              <TrialDaysIconButton
                daysLeft={trialDaysLeft}
                urgent={trialDaysLeft <= 3}
                onClick={onRestoreTrialBanner}
              />
            ) : null}
            <NotificationBell basePath="/tech" />
          </div>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {profile?.full_name || user?.email}
        </div>
        <div className="text-xs text-primary font-medium mt-0.5">Technician</div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.to === "/tech"
              ? location.pathname === "/tech"
              : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
              )}
              onClick={() => onNavigate?.()}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border space-y-1">
        <NavLink
          to="/tech/settings"
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            location.pathname.startsWith("/tech/settings")
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
          )}
          onClick={() => onNavigate?.()}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </NavLink>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
