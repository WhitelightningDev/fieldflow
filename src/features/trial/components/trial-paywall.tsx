import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Shield, Zap } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { PLANS, formatZar } from "@/features/subscription/plans";
import { useNavigate } from "react-router-dom";

export default function TrialPaywall() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-10">
      <div className="text-center space-y-3 mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-sm font-medium">
          <Shield className="h-4 w-4" />
          Free trial expired
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Your 14-day free trial has ended
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Subscribe to a plan to continue managing your jobs, technicians, and customers.
          All your data is safe and waiting.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 w-full max-w-4xl">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className={`relative flex flex-col ${plan.popular ? "border-primary shadow-lg" : ""}`}
          >
            {plan.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" variant="default">
                <Crown className="h-3 w-3 mr-1" />
                Most popular
              </Badge>
            )}
            <CardHeader className="text-center">
              <CardTitle className="text-lg">{plan.name}</CardTitle>
              <CardDescription>{plan.featureLabels[0]}</CardDescription>
              <div className="pt-2">
                <span className="text-3xl font-bold">{formatZar(plan.basePriceCents)}</span>
                <span className="text-muted-foreground text-sm">/mo</span>
              </div>
              <p className="text-xs text-muted-foreground">
                + {formatZar(plan.perTechPriceCents)}/extra tech
              </p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ul className="space-y-2 flex-1">
                {plan.featureLabels.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full mt-6"
                variant={plan.popular ? "default" : "outline"}
                onClick={() => navigate(`/subscribe?plan=${plan.tier}`)}
              >
                <Zap className="h-4 w-4 mr-2" />
                Choose {plan.name}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          All plans include a per-technician fee. Annual billing saves 20%.
        </p>
        <Button
          variant="link"
          size="sm"
          className="text-xs"
          onClick={() => void signOut()}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
