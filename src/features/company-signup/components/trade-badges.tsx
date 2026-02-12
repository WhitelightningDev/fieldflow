import { Badge } from "@/components/ui/badge";
import { TRADES } from "@/features/company-signup/content/trades";

export default function TradeBadges() {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold">Built for service trades</div>
        <div className="text-sm text-muted-foreground">
          Electrical, plumbing, mobile mechanics, refrigeration, and appliance repair.
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {TRADES.map((trade) => (
          <Badge key={trade.id} variant="secondary" className="gap-1.5">
            <trade.icon className="h-3.5 w-3.5" />
            {trade.shortName}
          </Badge>
        ))}
      </div>
    </div>
  );
}

