import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { isTradeId, type TradeId } from "@/features/company-signup/content/trades";

export function useIndustrySearchParam() {
  const [searchParams, setSearchParams] = useSearchParams();

  const industry = useMemo<TradeId | undefined>(() => {
    const value = searchParams.get("industry");
    return isTradeId(value) ? value : undefined;
  }, [searchParams]);

  const setIndustry = useCallback(
    (tradeId: TradeId, opts?: { replace?: boolean }) => {
      const next = new URLSearchParams(searchParams);
      next.set("industry", tradeId);
      setSearchParams(next, { replace: opts?.replace ?? true });
    },
    [searchParams, setSearchParams],
  );

  return { industry, setIndustry };
}

