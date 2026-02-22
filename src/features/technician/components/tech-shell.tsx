import TechSidebar from "./tech-sidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/notification-bell";
import { Menu, MessageSquare } from "lucide-react";
import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/use-auth";

export default function TechShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { profile } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);

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
    <div className="flex min-h-[100dvh] bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <TechSidebar />
      </div>

      {/* Mobile topbar + drawer nav */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden sticky top-0 z-30 border-b bg-background/80 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
          <div className="h-14 px-4 flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{title}</div>
              <div className="text-[11px] text-muted-foreground truncate">{profile?.full_name ?? "Technician"}</div>
            </div>
            <Button asChild variant="ghost" size="icon" aria-label="Messages">
              <Link to="/tech/messages">
                <MessageSquare className="h-5 w-5" />
              </Link>
            </Button>
            <NotificationBell basePath="/tech" />
          </div>
        </div>

        <div className="lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="p-0 w-[85vw] max-w-72">
              <SheetTitle className="sr-only">Technician menu</SheetTitle>
              <TechSidebar onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>

        <main className="flex-1 overflow-y-auto px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
