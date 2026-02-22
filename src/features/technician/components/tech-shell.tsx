import TechSidebar from "./tech-sidebar";
import TechBottomNav from "./tech-bottom-nav";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/notification-bell";
import { Menu, MessageSquare } from "lucide-react";
import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export default function TechShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { profile, user } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);
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

  const title = React.useMemo(() => {
    const p = location.pathname;
    if (p === "/tech") return "Dispatch";
    if (p.startsWith("/tech/my-jobs")) return "My jobs";
    if (p.startsWith("/tech/job/")) return "Job";
    if (p.startsWith("/tech/inventory")) return "Inventory";
    if (p.startsWith("/tech/messages")) return "Messages";
    if (p.startsWith("/tech/settings")) return "Settings";
    if (p.startsWith("/tech/solar")) return "Solar tasks";
    if (p.startsWith("/tech/coc")) return "COC certs";
    if (p.startsWith("/tech/service-calls")) return "Service calls";
    if (p.startsWith("/tech/vehicle-logs")) return "Vehicle logs";
    if (p.startsWith("/tech/service-logs")) return "Service logs";
    if (p.startsWith("/tech/compliance")) return "Compliance";
    if (p.startsWith("/tech/warranty")) return "Warranty";
    if (p.startsWith("/tech/repairs")) return "Repairs";
    return "Technician";
  }, [location.pathname]);

  return (
    <div className="flex h-[100dvh] bg-background">
      {/* Desktop sidebar */}
      <div className="hidden xl:flex">
        <TechSidebar />
      </div>

      {/* Mobile topbar + drawer nav */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="xl:hidden sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
          <div className="h-12 px-3 flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{title}</div>
            </div>
            <Button asChild variant="ghost" size="icon" className="h-9 w-9" aria-label="Messages">
              <Link to="/tech/messages">
                <MessageSquare className="h-5 w-5" />
              </Link>
            </Button>
            <NotificationBell basePath="/tech" />
          </div>
        </div>

        <div className="xl:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="p-0 w-[85vw] max-w-72">
              <SheetTitle className="sr-only">Technician menu</SheetTitle>
              <TechSidebar onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>

        {/* Main content area — extra bottom padding for bottom nav on mobile */}
        <main className="flex-1 min-h-0 overflow-y-auto px-3 py-3 pb-[calc(4rem+env(safe-area-inset-bottom))] xl:pb-6 sm:px-5 sm:py-4">
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <TechBottomNav industry={industry} />
      </div>
    </div>
  );
}
