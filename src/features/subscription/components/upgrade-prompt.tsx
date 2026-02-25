import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { type PlanTier, getPlan, formatZar } from "@/features/subscription/plans";

interface Props {
  feature: string;
  requiredTier: PlanTier;
  currentTier: PlanTier;
}

export default function UpgradePrompt({ feature, requiredTier, currentTier }: Props) {
  const navigate = useNavigate();
  const plan = getPlan(requiredTier);

  return (
    <div className="flex items-center justify-center py-16">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>{feature} requires {plan.name} plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You're currently on the <span className="font-medium capitalize">{currentTier}</span> plan.
            Upgrade to <span className="font-medium">{plan.name}</span> ({formatZar(plan.basePriceCents)}/mo) to unlock this feature.
          </p>
          <Button onClick={() => navigate(`/subscribe?plan=${requiredTier}`)}>
            <Zap className="h-4 w-4 mr-2" /> Upgrade to {plan.name}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
