import { formatZarFromCents } from "@/lib/money";
import type { Profitability } from "@/features/dashboard/lib/profitability";

export default function ProfitabilityPill({ value }: { value: Profitability | null | undefined }) {
  if (!value || !value.complete || value.grossMarginCents === null) {
    return (
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
        Needs revenue/rates
      </span>
    );
  }

  const margin = value.grossMarginCents;
  const pct = value.grossMarginPct;
  const label = margin >= 0 ? "Profitable" : "Bleeding";
  const classes =
    margin >= 0
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
      : "border-rose-500/30 bg-rose-500/10 text-rose-700";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classes}`}>
      {label}: {formatZarFromCents(margin)}
      {pct !== null ? ` (${Math.round(pct * 100)}%)` : ""}
    </span>
  );
}
