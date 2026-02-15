import { isTradeId, type TradeId, TRADES } from "@/features/company-signup/content/trades";
import * as React from "react";
import { useSearchParams } from "react-router-dom";

export type TradeFilter = "all" | TradeId;

export function useTradeFilter(allowedTradeIds?: readonly TradeId[] | null) {
  const [searchParams, setSearchParams] = useSearchParams();

  const allowed = React.useMemo<TradeId[]>(() => {
    if (allowedTradeIds && allowedTradeIds.length > 0) {
      return Array.from(new Set(allowedTradeIds));
    }
    return TRADES.map((t) => t.id);
  }, [allowedTradeIds]);

  const trade = React.useMemo<TradeFilter>(() => {
    if (allowed.length === 1) return allowed[0];
    const raw = searchParams.get("trade");
    if (!raw || raw === "all") return "all";
    if (!isTradeId(raw)) return "all";
    return allowed.includes(raw) ? raw : "all";
  }, [allowed, searchParams]);

  const setTrade = React.useCallback(
    (next: TradeFilter) => {
      if (allowed.length === 1) return;
      const params = new URLSearchParams(searchParams);
      params.set("trade", next);
      setSearchParams(params, { replace: true });
    },
    [allowed.length, searchParams, setSearchParams],
  );

  const options = React.useMemo(() => {
    const allowedTrades = TRADES.filter((t) => allowed.includes(t.id));
    if (allowedTrades.length <= 1) {
      return allowedTrades.map((t) => ({ value: t.id, label: t.name }));
    }
    return [{ value: "all" as const, label: "All trades" }, ...allowedTrades.map((t) => ({ value: t.id, label: t.name }))];
  }, [allowed]);

  return { trade, setTrade, options };
}
