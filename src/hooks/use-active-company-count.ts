import * as React from "react";
import { supabase } from "@/integrations/supabase/client";

type CachedCount = { count: number; fetchedAt: number };

const CACHE_KEY = "fieldflow.active_company_count.v1";
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

function readCache(): CachedCount | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedCount>;
    if (typeof parsed.count !== "number") return null;
    if (!Number.isFinite(parsed.count) || parsed.count < 0) return null;
    if (typeof parsed.fetchedAt !== "number" || !Number.isFinite(parsed.fetchedAt)) return null;
    return { count: parsed.count, fetchedAt: parsed.fetchedAt };
  } catch {
    return null;
  }
}

function writeCache(value: CachedCount) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // ignore (private mode / storage disabled)
  }
}

function coerceCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function useActiveCompanyCount() {
  const cached = React.useMemo(() => readCache(), []);
  const [count, setCount] = React.useState<number | null>(cached?.count ?? null);
  const [loading, setLoading] = React.useState<boolean>(() => {
    if (!cached) return true;
    return Date.now() - cached.fetchedAt > CACHE_TTL_MS;
  });

  React.useEffect(() => {
    const cachedNow = readCache();
    if (cachedNow && Date.now() - cachedNow.fetchedAt <= CACHE_TTL_MS) {
      setCount(cachedNow.count);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const { data, error } = await supabase.rpc("get_active_company_count" as any);
        if (error) return;

        const n = coerceCount(data);
        if (n == null || n < 0) return;

        if (cancelled) return;
        setCount(n);
        setLoading(false);
        writeCache({ count: n, fetchedAt: Date.now() });
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return { count, loading };
}

