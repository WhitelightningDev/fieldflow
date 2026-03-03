import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { isTradeId, type TradeId } from "@/features/company-signup/content/trades";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useTradeFilter } from "@/features/dashboard/hooks/use-trade-filter";
import TradeFilterSelect from "@/features/dashboard/components/trade-filter-select";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import NotificationBell from "@/components/notification-bell";
import { Building2, LayoutGrid, Sparkles, Search } from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";
import ComplianceStatusIcon from "@/features/compliance/components/compliance-status-icon";
import { useTrialStatus } from "@/features/trial/hooks/use-trial-status";
import { useTrialBannerDismissal } from "@/features/trial/hooks/use-trial-banner-dismissal";
import TrialDaysIconButton from "@/features/trial/components/trial-days-icon-button";
import { useAiAssist } from "@/features/ai/ai-assist-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function DashboardTopbar({ onOpenCompliance }: { onOpenCompliance?: () => void }) {
  const { profile, roles, loading: authLoading, profileLoading } = useAuth();
  const { data } = useDashboardData();
  const { openAssist } = useAiAssist();
  const company = data.company as any;
  const canCreateCompany = roles.includes("owner") || roles.includes("admin");
  const trialStatus = useTrialStatus(company);
  const trialDismissal = useTrialBannerDismissal({
    companyId: company?.id ?? null,
    endsAt: trialStatus.state === "trialing" ? trialStatus.endsAt : null,
  });

  const allowedTradeIds = React.useMemo<TradeId[] | null>(() => {
    const industry = data.company?.industry ?? null;
    return industry && isTradeId(industry) ? [industry] : null;
  }, [data.company?.industry]);

  const { trade, setTrade, options } = useTradeFilter(allowedTradeIds);

  const initials = React.useMemo(() => {
    const name = profile?.full_name ?? company?.name ?? "U";
    return name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  }, [profile?.full_name, company?.name]);

  return (
    <div className="sticky top-0 z-30 border-b border-border/30 bg-card/80 backdrop-blur-xl">
      <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 h-12 sm:h-14">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground shrink-0" />
        <div className="flex-1 flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-foreground">
            <LayoutGrid className="h-4 w-4 text-primary" />
            Dashboard
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {trialStatus.state === "trialing" && trialDismissal.dismissed ? (
              <TrialDaysIconButton
                daysLeft={trialStatus.daysLeft}
                urgent={trialStatus.daysLeft <= 3}
                onClick={trialDismissal.restore}
              />
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => openAssist()}
              aria-label="Open AI Assistant"
              title="AI Assistant"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
            <NotificationBell basePath="/dashboard" />
            {options.length > 1 ? (
              <div className="hidden sm:block">
                <TradeFilterSelect value={trade} onChange={setTrade} options={options} />
              </div>
            ) : null}
            {!authLoading && !profileLoading && profile?.company_id ? (
              <div className="hidden sm:flex items-center gap-2.5 ml-2 pl-2.5 border-l border-border/30">
                <Avatar className="h-8 w-8">
                  {company?.logo_url ? (
                    <img src={company.logo_url} alt={company.name} className="h-full w-full object-contain" />
                  ) : (
                    <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight truncate">{profile?.full_name ?? company?.name ?? "User"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{company?.industry ? company.industry.replace(/-/g, " ") : "Manager"}</p>
                </div>
                {company?.id ? (
                  canCreateCompany && onOpenCompliance ? (
                    <button type="button" className="shrink-0" onClick={onOpenCompliance} aria-label="Open compliance wizard">
                      <ComplianceStatusIcon company={company} />
                    </button>
                  ) : (
                    <ComplianceStatusIcon company={company} />
                  )
                ) : null}
              </div>
            ) : !authLoading && !profileLoading && canCreateCompany ? (
              <Button asChild variant="outline" size="sm" className="rounded-lg">
                <Link to="/dashboard/create-company">Create company</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
