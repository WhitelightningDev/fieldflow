import { isTradeId, type TradeId, TRADES } from "@/features/company-signup/content/trades";
import * as React from "react";
import { useSearchParams } from "react-router-dom";

export type TradeFilter = "all" | TradeId;

export function useTradeFilter() {
  const [searchParams, setSearchParams] = useSearchParams();

  const trade = React.useMemo<TradeFilter>(() => {
    const raw = searchParams.get("trade");
    if (!raw || raw === "all") return "all";
    return isTradeId(raw) ? raw : "all";
  }, [searchParams]);

  const setTrade = React.useCallback(
    (next: TradeFilter) => {
      const params = new URLSearchParams(searchParams);
      params.set("trade", next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const options = React.useMemo(() => [{ value: "all" as const, label: "All trades" }, ...TRADES.map((t) => ({ value: t.id, label: t.name }))], []);

  return { trade, setTrade, options };
}

