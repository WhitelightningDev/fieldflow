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
import { useTrialStatus } from "@/features/trial/hooks/use-trial-status";
import { useTrialBannerDismissal } from "@/features/trial/hooks/use-trial-banner-dismissal";
import TrialBanner from "@/features/trial/components/trial-banner";
import TrialPaywall from "@/features/trial/components/trial-paywall";
import TrialDaysIconButton from "@/features/trial/components/trial-days-icon-button";

export default function TechShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { profile } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [industry, setIndustry] = React.useState<string | null>(null);
  const [company, setCompany] = React.useState<any>(null);
  const trialStatus = useTrialStatus(company);
  const trialDismissal = useTrialBannerDismissal({
    companyId: profile?.company_id ?? null,
    endsAt: trialStatus.state === "trialing" ? trialStatus.endsAt : null,
  });
  const showTrialBanner = trialStatus.state === "trialing" && !trialDismissal.dismissed;

  React.useEffect(() => {
    if (!profile?.company_id) return;
    supabase
      .from("companies")
      .select("industry, trial_ends_at, subscription_status")
      .eq("id", profile.company_id)
      .single()
      .then(({ data }) => {
        if (data) {
          setIndustry(data.industry);
          setCompany(data);
        }
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
        <TechSidebar
          trialDaysLeft={trialStatus.state === "trialing" ? trialStatus.daysLeft : undefined}
          showTrialDaysIcon={trialStatus.state === "trialing" && trialDismissal.dismissed}
          onRestoreTrialBanner={trialDismissal.restore}
        />
      </div>

      {/* Mobile topbar + drawer nav */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="xl:hidden sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl pt-[max(env(safe-area-inset-top),0.5rem)]">
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
            {trialStatus.state === "trialing" && trialDismissal.dismissed ? (
              <TrialDaysIconButton
                daysLeft={trialStatus.daysLeft}
                urgent={trialStatus.daysLeft <= 3}
                onClick={trialDismissal.restore}
              />
            ) : null}
            <NotificationBell basePath="/tech" />
          </div>
        </div>

        <div className="xl:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="p-0 w-[85vw] max-w-72">
              <SheetTitle className="sr-only">Technician menu</SheetTitle>
              <div className="h-full pt-[max(env(safe-area-inset-top),0.5rem)] pb-[max(env(safe-area-inset-bottom),0.5rem)]">
                <TechSidebar
                  onNavigate={() => setMobileOpen(false)}
                  trialDaysLeft={trialStatus.state === "trialing" ? trialStatus.daysLeft : undefined}
                  showTrialDaysIcon={trialStatus.state === "trialing" && trialDismissal.dismissed}
                  onRestoreTrialBanner={trialDismissal.restore}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {showTrialBanner ? (
          <TrialBanner status={trialStatus} dismissible onDismiss={trialDismissal.dismiss} />
        ) : null}

        {/* Main content area — extra bottom padding for bottom nav on mobile */}
        <main className="flex-1 min-h-0 overflow-y-auto px-4 py-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] xl:pb-6 sm:px-5 sm:py-5">
          {trialStatus.state === "expired" ? <TrialPaywall /> : children}
        </main>

        {/* Mobile bottom tab bar */}
        <TechBottomNav industry={industry} />
      </div>
    </div>
  );
}
