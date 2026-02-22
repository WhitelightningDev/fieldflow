import { getTechIndustryNav } from "@/features/technician/constants/tech-industry-nav";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import * as React from "react";

/**
 * Mobile bottom tab bar for technicians.
 * Shows the first 5 nav items (most important ones).
 */
export default function TechBottomNav({ industry }: { industry: string | null }) {
  const location = useLocation();
  const navItems = getTechIndustryNav(industry);

  // Show at most 5 items in the bottom bar
  const tabs = navItems.slice(0, 5);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] xl:hidden">
      <div className="flex items-stretch justify-around h-14">
        {tabs.map((item) => {
          const isActive =
            item.to === "/tech"
              ? location.pathname === "/tech"
              : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors min-w-0",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground",
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className="truncate max-w-[64px]">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
