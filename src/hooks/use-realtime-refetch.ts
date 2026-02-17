import * as React from "react";
import { supabase } from "@/integrations/supabase/client";

export type RealtimeSyncStatus = "idle" | "connecting" | "subscribed" | "error" | "closed";

type Args = {
  enabled: boolean;
  channelName: string;
  schema?: string;
  table: string;
  filter?: string;
  debounceMs?: number;
  onRefetch: () => void | Promise<void>;
};

export function useRealtimeRefetch({
  enabled,
  channelName,
  schema = "public",
  table,
  filter,
  debounceMs = 500,
  onRefetch,
}: Args) {
  const onRefetchRef = React.useRef(onRefetch);
  React.useEffect(() => {
    onRefetchRef.current = onRefetch;
  }, [onRefetch]);

  const [status, setStatus] = React.useState<RealtimeSyncStatus>(enabled ? "connecting" : "idle");
  const timeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    setStatus("connecting");

    const schedule = () => {
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        void onRefetchRef.current();
      }, debounceMs);
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema, table, ...(filter ? { filter } : {}) },
        () => schedule(),
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") {
          setStatus("subscribed");
          schedule(); // resync on (re)connect
          return;
        }
        if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
          setStatus("error");
          return;
        }
        if (s === "CLOSED") {
          setStatus("closed");
        }
      });

    return () => {
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [debounceMs, enabled, channelName, filter, schema, table]);

  return { status };
}

