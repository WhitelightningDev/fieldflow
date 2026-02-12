import { Button } from "@/components/ui/button";
import AuthLayout from "@/features/auth/components/auth-layout";
import CompanySignupForm from "@/features/company-signup/components/company-signup-form";
import TradeCardsGrid from "@/features/company-signup/components/trade-cards-grid";
import { COMPANY_SIGNUP_FEATURES } from "@/features/company-signup/content/features";
import { TRADES, getTradeById } from "@/features/company-signup/content/trades";
import { useCompanySignupForm } from "@/features/company-signup/hooks/use-company-signup-form";
import { useIndustrySearchParam } from "@/features/company-signup/hooks/use-industry-search-param";
import { CheckCircle2 } from "lucide-react";
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function CompanySignup() {
  const navigate = useNavigate();
  const { industry, setIndustry } = useIndustrySearchParam();
  const { form, submit } = useCompanySignupForm({
    defaultIndustry: industry ?? TRADES[0].id,
    onSuccess: () => navigate("/login"),
  });

  React.useEffect(() => {
    if (!industry) return;
    if (industry === form.getValues("industry")) return;
    form.setValue("industry", industry, { shouldValidate: true, shouldDirty: true });
  }, [form, industry]);

  const selected = form.watch("industry");
  const trade = getTradeById(selected);

  return (
    <AuthLayout
      title={`Start FieldFlow for ${trade.shortName}.`}
      subtitle={trade.hook}
      topRight={
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild size="sm" className="gradient-bg hover:opacity-90 shadow-glow">
            <Link to="/signup">Join a team</Link>
          </Button>
        </div>
      }
      side={
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="text-sm font-semibold">Choose your industry</div>
            <TradeCardsGrid
              selected={selected}
              to={(tradeId) => `/company-signup?industry=${tradeId}`}
            />
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold">What you’ll get</div>
            <ul className="space-y-2">
              {COMPANY_SIGNUP_FEATURES.slice(0, 5).map((feature) => (
                <li key={feature.title} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                  <span>
                    <span className="text-foreground font-medium">{feature.title}:</span> {feature.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      }
    >
      <CompanySignupForm
        form={form}
        onSubmit={submit}
        onIndustrySelect={(tradeId) => {
          setIndustry(tradeId);
        }}
      />
    </AuthLayout>
  );
}
