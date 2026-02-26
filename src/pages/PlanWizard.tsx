import AuthLayout from "@/features/auth/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Crown, ArrowRight } from "lucide-react";
import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { type PlanTier, PLANS, getPlan, formatZar } from "@/features/subscription/plans";

function isPlanTier(v: string | null): v is PlanTier {
  return v === "starter" || v === "pro" || v === "business";
}

export default function PlanWizard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const initialTier = React.useMemo<PlanTier>(() => {
    const raw = params.get("plan");
    if (isPlanTier(raw)) return raw;
    return "pro";
  }, [params]);

  const industry = params.get("industry");
  const [tier, setTier] = React.useState<PlanTier>(initialTier);

  const plan = getPlan(tier);
  const nextQuery = new URLSearchParams();
  nextQuery.set("plan", tier);
  if (industry) nextQuery.set("industry", industry);

  return (
    <AuthLayout
      title="Choose your plan."
      subtitle="Pick a plan for your free trial. You can change it later."
      topRight={
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Already have an account? <span className="text-primary">Log in</span>
        </Link>
      }
      side={
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="font-semibold text-foreground">How it works</div>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary mt-0.5" />
              <span>Select a plan for your trial</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary mt-0.5" />
              <span>Create your company account</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary mt-0.5" />
              <span>Invite techs and start dispatching</span>
            </li>
          </ul>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <div className="text-2xl font-bold">Plan wizard</div>
          <div className="text-sm text-muted-foreground">Choose a plan, then start your free trial.</div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((p) => (
            <Card
              key={p.tier}
              role="button"
              tabIndex={0}
              className={`relative cursor-pointer transition-all ${
                tier === p.tier ? "border-primary shadow-lg ring-2 ring-primary/20" : "hover:border-primary/50"
              } ${p.popular ? "border-primary" : ""}`}
              onClick={() => setTier(p.tier)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setTier(p.tier);
                }
              }}
            >
              {p.popular ? (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Crown className="h-3 w-3 mr-1" /> Most popular
                </Badge>
              ) : null}
              <CardHeader className="text-center">
                <CardTitle className="text-lg">{p.name}</CardTitle>
                <div className="pt-2">
                  <span className="text-3xl font-bold">{formatZar(p.basePriceCents)}</span>
                  <span className="text-muted-foreground text-sm">/mo</span>
                </div>
                <CardDescription className="text-xs">
                  Includes {p.includedTechs} tech{p.includedTechs > 1 ? "s" : ""}; +{formatZar(p.perTechPriceCents)}/extra tech
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {p.featureLabels.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Selected: <span className="font-medium text-foreground">{plan.name}</span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => navigate("/login")}>
              Back to login
            </Button>
            <Button asChild type="button" className="gradient-bg hover:opacity-90 shadow-glow">
              <Link to={`/company-signup?${nextQuery.toString()}`}>
                Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}

