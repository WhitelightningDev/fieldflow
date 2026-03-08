import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadshedding, type EspStatus, type EspAreaInfo } from "../lib/loadshedding-api";

export type LoadsheddingConfig = {
  id: string;
  company_id: string;
  area_id: string;
  area_name: string;
  region: string | null;
};

export function useLoadsheddingConfig(companyId: string | null | undefined) {
  const [config, setConfig] = React.useState<LoadsheddingConfig | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    const { data } = await supabase
      .from("company_loadshedding_config")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    setConfig(data as any);
    setLoading(false);
  }, [companyId]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  return { config, loading, refresh };
}

export function useNationalStatus() {
  const [status, setStatus] = React.useState<EspStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    loadshedding.status()
      .then((d) => { if (!cancelled) setStatus(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { status, loading, error };
}

export function useAreaSchedule(areaId: string | null | undefined) {
  const [schedule, setSchedule] = React.useState<EspAreaInfo | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!areaId) return;
    let cancelled = false;
    setLoading(true);
    loadshedding.area(areaId)
      .then((d) => { if (!cancelled) setSchedule(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [areaId]);

  return { schedule, loading, error };
}

/** Check if a scheduled_at timestamp falls within any load shedding event */
export function isJobDuringOutage(
  scheduledAt: string | null | undefined,
  events: Array<{ start: string; end: string }>,
): boolean {
  if (!scheduledAt || events.length === 0) return false;
  const jobTime = new Date(scheduledAt).getTime();
  return events.some((e) => {
    const start = new Date(e.start).getTime();
    const end = new Date(e.end).getTime();
    return jobTime >= start && jobTime <= end;
  });
}

/** Trades that typically require power */
const POWER_TRADES = new Set(["electrical-contracting", "appliance-repair", "refrigeration"]);

export function tradeRequiresPower(tradeId: string): boolean {
  return POWER_TRADES.has(tradeId);
}
