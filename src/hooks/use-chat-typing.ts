import * as React from "react";
import { supabase } from "@/integrations/supabase/client";

type PresenceState = Record<string, Array<Record<string, any>>>;

function computeOthersTyping(state: PresenceState, currentUserId: string) {
  for (const [key, metas] of Object.entries(state ?? {})) {
    if (!key || key === currentUserId) continue;
    if ((metas ?? []).some((m) => Boolean(m?.typing))) return true;
  }
  return false;
}

export function useChatTyping(threadId: string | null | undefined, currentUserId: string | null | undefined) {
  const [othersTyping, setOthersTyping] = React.useState(false);
  const channelRef = React.useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingRef = React.useRef(false);
  const stopTimerRef = React.useRef<number | null>(null);

  const sync = React.useCallback(() => {
    const channel = channelRef.current as any;
    if (!channel || !currentUserId) return;
    try {
      const state = (channel.presenceState?.() ?? {}) as PresenceState;
      setOthersTyping(computeOthersTyping(state, currentUserId));
    } catch {
      // ignore
    }
  }, [currentUserId]);

  const setTyping = React.useCallback(async (v: boolean) => {
    typingRef.current = v;
    const channel = channelRef.current as any;
    if (!channel) return;
    try {
      await channel.track?.({ typing: v, at: Date.now() });
    } catch {
      // ignore
    }
  }, []);

  const bumpTyping = React.useCallback(() => {
    if (!typingRef.current) void setTyping(true);
    if (stopTimerRef.current != null) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = window.setTimeout(() => {
      stopTimerRef.current = null;
      void setTyping(false);
    }, 1200);
  }, [setTyping]);

  const stopTyping = React.useCallback(() => {
    if (stopTimerRef.current != null) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    if (typingRef.current) void setTyping(false);
  }, [setTyping]);

  React.useEffect(() => {
    if (!threadId || !currentUserId) {
      setOthersTyping(false);
      return;
    }

    const channel = supabase.channel(`chat-typing:${threadId}`, {
      config: { presence: { key: currentUserId } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync);

    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        void setTyping(typingRef.current);
        sync();
      }
    });

    return () => {
      try {
        stopTyping();
        (channel as any).untrack?.();
      } catch {
        // ignore
      }
      supabase.removeChannel(channel);
      channelRef.current = null;
      setOthersTyping(false);
    };
  }, [currentUserId, setTyping, stopTyping, sync, threadId]);

  return { othersTyping, bumpTyping, stopTyping };
}

