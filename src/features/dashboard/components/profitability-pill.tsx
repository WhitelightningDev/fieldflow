import { formatZarFromCents } from "@/lib/money";
import type { Profitability } from "@/features/dashboard/lib/profitability";

export default function ProfitabilityPill({ value }: { value: Profitability | null | undefined }) {
  if (!value || !value.complete || value.grossMarginCents === null) {
    return (
      <span
        className="inline-flex min-w-0 items-center rounded-full border px-2 py-1 text-xs leading-none text-muted-foreground truncate"
        title="Needs revenue/rates"
      >
        Needs revenue/rates
      </span>
    );
  }

  const margin = value.grossMarginCents;
  const pct = value.grossMarginPct;
  const label = margin >= 0 ? "Profitable" : "Bleeding";
  const text = `${label}: ${formatZarFromCents(margin)}${pct !== null ? ` (${Math.round(pct * 100)}%)` : ""}`;
  const classes =
    margin >= 0
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
      : "border-rose-500/30 bg-rose-500/10 text-rose-700";

  return (
    <span
      className={`inline-flex min-w-0 items-center rounded-full border px-2 py-1 text-xs font-medium leading-none truncate ${classes}`}
      title={text}
    >
      {text}
    </span>
  );
}
