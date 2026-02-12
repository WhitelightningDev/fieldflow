import { Link } from "react-router-dom";
import { TRADES, type TradeId } from "@/features/company-signup/content/trades";
import { cn } from "@/lib/utils";

type Props = {
  selected?: TradeId;
  to: (tradeId: TradeId) => string;
  className?: string;
};

export default function TradeCardsGrid({ selected, to, className }: Props) {
  return (
    <div className={cn("grid sm:grid-cols-2 gap-3", className)}>
      {TRADES.map((trade) => {
        const isSelected = trade.id === selected;
        return (
          <Link
            key={trade.id}
            to={to(trade.id)}
            className={cn(
              "group rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm p-4 hover-lift",
              isSelected && "ring-2 ring-primary/60 border-primary/40",
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", isSelected ? "gradient-bg" : "bg-secondary")}>
                <trade.icon className={cn("h-5 w-5", isSelected ? "text-primary-foreground" : "text-foreground")} />
              </div>
              <div className="min-w-0">
                <div className="font-semibold leading-tight">{trade.name}</div>
                <div className="text-sm text-muted-foreground leading-snug">{trade.hook}</div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
