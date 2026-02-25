import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/features/auth/hooks/use-auth";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { toast } from "@/hooks/use-toast";
import { useChatTyping } from "@/hooks/use-chat-typing";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { MessageSquare, Send } from "lucide-react";
import * as React from "react";
import { useSearchParams } from "react-router-dom";
import TypingBubble from "@/components/chat/typing-bubble";
import { useFeatureGate } from "@/features/subscription/hooks/use-feature-gate";
import UpgradePrompt from "@/features/subscription/components/upgrade-prompt";

type ChatThread = {
  id: string;
  company_id: string;
  technician_id: string;
  created_at: string;
  updated_at: string;
};

type ChatMessage = {
  id: string;
  thread_id: string;
  company_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
};

type ChatMessageUI = ChatMessage & {
  _status?: "sending" | "failed";
};

type ChatRead = {
  thread_id: string;
  user_id: string;
  last_read_at: string;
};

function createClientUuid() {
  try {
    // Modern browsers (including iOS Safari 15.4+) support this.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any)?.crypto as Crypto | undefined;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    // ignore
  }
  // Fallback (UUID v4-ish). Not cryptographically strong, but valid format for uuid columns.
  let d = Date.now();
  let d2 = (typeof performance !== "undefined" && performance.now) ? performance.now() * 1000 : 0;
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    let r = Math.random() * 16;
    if (d > 0) {
      r = (d + r) % 16;
      d = Math.floor(d / 16);
    } else {
      r = (d2 + r) % 16;
      d2 = Math.floor(d2 / 16);
    }
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function safeDateMs(v: string | null | undefined) {
  const ms = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(ms) ? ms : 0;
}

function pickFirstByThreadId(rows: ChatMessage[]) {
  const m = new Map<string, ChatMessage>();
  for (const r of rows) {
    if (!r?.thread_id) continue;
    if (!m.has(r.thread_id)) m.set(r.thread_id, r);
  }
  return m;
}

function mergeMessagesById(prev: ChatMessageUI[], incoming: ChatMessage[]) {
  if (!incoming || incoming.length === 0) return prev;
  const next = prev.slice();
  const idxById = new Map<string, number>();
  for (let i = 0; i < next.length; i++) idxById.set(next[i].id, i);
  for (const row of incoming) {
    const idx = idxById.get(row.id);
    if (idx === undefined) {
      idxById.set(row.id, next.length);
      next.push(row);
    } else {
      // Preserve UI state only if still sending/failed; server row wins otherwise.
      const existing = next[idx];
      const status = existing?._status ?? null;
      next[idx] = status ? ({ ...row, _status: status } as ChatMessageUI) : (row as ChatMessageUI);
    }
  }
  next.sort((a, b) => safeDateMs(a.created_at) - safeDateMs(b.created_at));
  return next;
}

export default function Messages() {
  const { user, profile } = useAuth();
  const { data } = useDashboardData();
  const company = data.company as any;
  const gate = useFeatureGate(company?.subscription_tier);
  const [searchParams, setSearchParams] = useSearchParams();

  const [threads, setThreads] = React.useState<ChatThread[]>([]);
  const [loadingThreads, setLoadingThreads] = React.useState(true);
  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessageUI[]>([]);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [openingTechId, setOpeningTechId] = React.useState<string | null>(null);
  const sendingRef = React.useRef(false);
  const loadSeqRef = React.useRef(0);

  const [readsByThreadId, setReadsByThreadId] = React.useState(() => new Map<string, string>());
  const [lastMsgByThreadId, setLastMsgByThreadId] = React.useState(() => new Map<string, ChatMessage>());

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const lastServerCreatedAtRef = React.useRef(new Map<string, string>());
  const autoScrollRef = React.useRef(true);
  const [autoScrollEnabled, setAutoScrollEnabled] = React.useState(true);
  const [hasNewBelow, setHasNewBelow] = React.useState(false);

  const companyId = profile?.company_id ?? null;
  const techniciansById = React.useMemo(() => new Map(data.technicians.map((t) => [t.id, t])), [data.technicians]);
  const { othersTyping, bumpTyping, stopTyping } = useChatTyping(selectedThreadId, user?.id);

  const threadsByTechId = React.useMemo(() => {
    const m = new Map<string, ChatThread>();
    for (const t of threads) m.set(t.technician_id, t);
    return m;
  }, [threads]);

  const selectedThread = React.useMemo(() => {
    if (!selectedThreadId) return null;
    return threads.find((t) => t.id === selectedThreadId) ?? null;
  }, [selectedThreadId, threads]);

  const scrollToBottom = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const updateAutoScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    const next = remaining < 140;
    autoScrollRef.current = next;
    setAutoScrollEnabled(next);
    if (next) setHasNewBelow(false);
  }, []);

  const scrollIfPinned = React.useCallback(() => {
    if (!autoScrollRef.current) return;
    setHasNewBelow(false);
    setTimeout(scrollToBottom, 0);
  }, [scrollToBottom]);

  const markRead = React.useCallback(async (threadId: string) => {
    if (!user?.id) return;
    const nowIso = new Date().toISOString();
    setReadsByThreadId((prev) => {
      const next = new Map(prev);
      next.set(threadId, nowIso);
      return next;
    });
    await supabase
      .from("chat_thread_reads")
      .upsert({ thread_id: threadId, user_id: user.id, last_read_at: nowIso } as any, { onConflict: "thread_id,user_id" });
  }, [user?.id]);

  const loadThreads = React.useCallback(async () => {
    if (!companyId || !user?.id) return;
    setLoadingThreads(true);

    const { data: threadRows, error } = await supabase
      .from("chat_threads")
      .select("id,company_id,technician_id,created_at,updated_at")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false });

    if (error) {
      setThreads([]);
      setLoadingThreads(false);
      return;
    }
    const nextThreads = (threadRows ?? []) as ChatThread[];
    setThreads(nextThreads);

    const ids = nextThreads.map((t) => t.id);
    if (ids.length > 0) {
      const [readsRes, lastRes] = await Promise.all([
        supabase
          .from("chat_thread_reads")
          .select("thread_id,user_id,last_read_at")
          .eq("user_id", user.id)
          .in("thread_id", ids),
        supabase
          .from("chat_messages")
          .select("id,thread_id,company_id,sender_user_id,body,created_at")
          .in("thread_id", ids)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (!readsRes.error) {
        const m = new Map<string, string>();
        for (const r of (readsRes.data ?? []) as ChatRead[]) m.set(r.thread_id, r.last_read_at);
        setReadsByThreadId(m);
      }
      if (!lastRes.error) {
        setLastMsgByThreadId(pickFirstByThreadId((lastRes.data ?? []) as ChatMessage[]));
      }
    } else {
      setReadsByThreadId(new Map());
      setLastMsgByThreadId(new Map());
    }

    setLoadingThreads(false);
  }, [companyId, user?.id]);

  const loadMessages = React.useCallback(async (threadId: string) => {
    const seq = ++loadSeqRef.current;
    setLoadingMessages(true);
    const { data: rows, error } = await supabase
      .from("chat_messages")
      .select("id,thread_id,company_id,sender_user_id,body,created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (!error) {
      if (seq !== loadSeqRef.current) return;
      const nextRows = (rows ?? []) as ChatMessageUI[];
      setMessages(nextRows);
      const last = nextRows.length > 0 ? nextRows[nextRows.length - 1].created_at : "";
      lastServerCreatedAtRef.current.set(threadId, last);
      autoScrollRef.current = true;
      setAutoScrollEnabled(true);
      setHasNewBelow(false);
      setTimeout(() => {
        scrollToBottom();
        updateAutoScroll();
      }, 0);
      void markRead(threadId);
    }
    setLoadingMessages(false);
  }, [markRead, scrollToBottom, updateAutoScroll]);

  const refreshNewMessages = React.useCallback(async (threadId: string) => {
    const lastServerCreatedAt = lastServerCreatedAtRef.current.get(threadId) || null;

    let q = supabase
      .from("chat_messages")
      .select("id,thread_id,company_id,sender_user_id,body,created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(50);
    if (lastServerCreatedAt) q = q.gt("created_at", lastServerCreatedAt);

    const { data: rows, error } = await q;
    if (error || !rows || rows.length === 0) return;

    const last = (rows as any[])[(rows as any[]).length - 1]?.created_at as string | undefined;
    if (last) lastServerCreatedAtRef.current.set(threadId, last);

    if (!autoScrollRef.current) setHasNewBelow(true);
    setMessages((prev) => mergeMessagesById(prev, rows as ChatMessage[]));
    scrollIfPinned();
    try {
      if (document.visibilityState === "visible") void markRead(threadId);
    } catch {
      // ignore
    }
  }, [markRead, scrollIfPinned]);

  const ensureThreadForTech = React.useCallback(async (technicianId: string) => {
    if (!companyId) return null;

    const existing = threadsByTechId.get(technicianId) ?? null;
    if (existing) return existing;

    // Try to load from DB first (covers existing threads not in local state).
    const { data: found, error: foundErr } = await supabase
      .from("chat_threads")
      .select("id,company_id,technician_id,created_at,updated_at")
      .eq("company_id", companyId)
      .eq("technician_id", technicianId)
      .maybeSingle();
    if (!foundErr && found) {
      const next = found as ChatThread;
      setThreads((prev) => (prev.some((t) => t.id === next.id) ? prev : [next, ...prev]));
      return next;
    }

    // Create-or-get via upsert to avoid unique constraint race/conflicts.
    const { data: row, error } = await supabase
      .from("chat_threads")
      .upsert({ company_id: companyId, technician_id: technicianId } as any, { onConflict: "company_id,technician_id" })
      .select("id,company_id,technician_id,created_at,updated_at")
      .single();

    if (error || !row) {
      // Fallback: thread may exist but upsert failed due to RLS; try select again.
      const { data: retry, error: retryErr } = await supabase
        .from("chat_threads")
        .select("id,company_id,technician_id,created_at,updated_at")
        .eq("company_id", companyId)
        .eq("technician_id", technicianId)
        .maybeSingle();
      if (!retryErr && retry) {
        const next = retry as ChatThread;
        setThreads((prev) => (prev.some((t) => t.id === next.id) ? prev : [next, ...prev]));
        return next;
      }

      toast({
        title: "Could not open chat",
        description: (error ?? retryErr ?? foundErr)?.message ?? "Chat thread could not be created or loaded.",
        variant: "destructive",
      });
      return null;
    }

    const next = row as ChatThread;
    setThreads((prev) => (prev.some((t) => t.id === next.id) ? prev : [next, ...prev]));
    return next;
  }, [companyId, threadsByTechId]);

  const sendBody = React.useCallback(async (body: string) => {
    if (!user?.id || !companyId || !selectedThreadId) return;
    if (!body) return;
    if (sendingRef.current) return;

    const messageId = createClientUuid();
    sendingRef.current = true;
    setSending(true);
    try {
      stopTyping();
      const optimistic: ChatMessageUI = {
        id: messageId,
        thread_id: selectedThreadId,
        company_id: companyId,
        sender_user_id: user.id,
        body,
        created_at: new Date().toISOString(),
        _status: "sending",
      };
      setMessages((prev) => [...prev, optimistic]);
      setTimeout(scrollToBottom, 0);

      const { data: inserted, error } = await supabase
        .from("chat_messages")
        .insert({ id: messageId, thread_id: selectedThreadId, company_id: companyId, sender_user_id: user.id, body } as any)
        .select("id,thread_id,company_id,sender_user_id,body,created_at")
        .single();

      if (error || !inserted) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, _status: "failed" } : m)));
        toast({ title: "Message not sent", description: error?.message ?? "Please try again.", variant: "destructive" });
        return;
      }

      setMessages((prev) => {
        const nextInserted = inserted as ChatMessage;
        const idx = prev.findIndex((m) => m.id === nextInserted.id);
        if (idx === -1) return [...prev, nextInserted];
        const next = prev.slice();
        next[idx] = nextInserted;
        return next;
      });

      setLastMsgByThreadId((prev) => {
        const next = new Map(prev);
        next.set(selectedThreadId, inserted as ChatMessage);
        return next;
      });

      await markRead(selectedThreadId);
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  }, [companyId, markRead, scrollToBottom, selectedThreadId, stopTyping, user?.id]);

  const send = React.useCallback(async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    await sendBody(body);
  }, [draft, sendBody]);

  const resendFailed = React.useCallback((m: ChatMessageUI) => {
    if (m._status !== "failed") return;
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    void sendBody(m.body);
  }, [sendBody]);

  React.useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  // If navigated in with ?thread=... select it.
  React.useEffect(() => {
    const threadId = searchParams.get("thread");
    if (!threadId) return;
    if (selectedThreadId === threadId) return;
    setSelectedThreadId(threadId);
  }, [searchParams, selectedThreadId]);

  React.useEffect(() => {
    if (!selectedThreadId) return;
    void loadMessages(selectedThreadId);
  }, [loadMessages, selectedThreadId]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => updateAutoScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    // Initialize
    updateAutoScroll();
    return () => el.removeEventListener("scroll", onScroll as any);
  }, [selectedThreadId, updateAutoScroll]);

  // Fallback polling: some iOS/PWA sessions miss realtime events. Poll for new messages while visible.
  React.useEffect(() => {
    if (!selectedThreadId) return;
    let intervalId: number | null = null;
    const start = () => {
      if (intervalId != null) return;
      intervalId = window.setInterval(() => {
        try {
          if (document.visibilityState !== "visible") return;
        } catch {
          // ignore
        }
        void refreshNewMessages(selectedThreadId);
      }, 2000);
    };
    const stop = () => {
      if (intervalId == null) return;
      window.clearInterval(intervalId);
      intervalId = null;
    };

    start();
    const onVis = () => {
      try {
        if (document.visibilityState === "visible") {
          start();
          void refreshNewMessages(selectedThreadId);
        } else {
          stop();
        }
      } catch {
        // ignore
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshNewMessages, selectedThreadId]);

  // Realtime: update message list + thread previews.
  React.useEffect(() => {
    if (!companyId || !user?.id) return;

    const threadsChannel = supabase
      .channel(`chat-threads:${companyId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_threads", filter: `company_id=eq.${companyId}` },
        (payload: any) => {
          const row = payload?.new as ChatThread | undefined;
          if (!row?.id) return;
          setThreads((prev) => {
            const next = prev.slice();
            const idx = next.findIndex((t) => t.id === row.id);
            if (idx === -1) next.unshift(row);
            else next[idx] = row;
            next.sort((a, b) => safeDateMs(b.updated_at) - safeDateMs(a.updated_at));
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_threads", filter: `company_id=eq.${companyId}` },
        (payload: any) => {
          const row = payload?.new as ChatThread | undefined;
          if (!row?.id) return;
          setThreads((prev) => {
            const next = prev.slice();
            const idx = next.findIndex((t) => t.id === row.id);
            if (idx === -1) next.unshift(row);
            else next[idx] = row;
            next.sort((a, b) => safeDateMs(b.updated_at) - safeDateMs(a.updated_at));
            return next;
          });
        },
      )
      .subscribe();

    const channel = supabase
      .channel(`chat-messages:${companyId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `company_id=eq.${companyId}` },
        (payload: any) => {
          const row = payload?.new as ChatMessage | undefined;
          if (!row?.id || !row.thread_id) return;

          setLastMsgByThreadId((prev) => {
            const next = new Map(prev);
            const current = next.get(row.thread_id);
            if (!current || safeDateMs(row.created_at) > safeDateMs(current.created_at)) next.set(row.thread_id, row);
            return next;
          });

          if (row.thread_id === selectedThreadId) {
            const currentLast = lastServerCreatedAtRef.current.get(row.thread_id) || "";
            if (!currentLast || safeDateMs(row.created_at) > safeDateMs(currentLast)) {
              lastServerCreatedAtRef.current.set(row.thread_id, row.created_at);
            }
            setMessages((prev) => mergeMessagesById(prev, [row]));
            if (!autoScrollRef.current) setHasNewBelow(true);
            scrollIfPinned();
            try {
              if (document.visibilityState === "visible") void markRead(row.thread_id);
            } catch {
              // ignore
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(threadsChannel);
      supabase.removeChannel(channel);
    };
  }, [companyId, markRead, scrollIfPinned, selectedThreadId, user?.id]);

  const rows = React.useMemo(() => {
    const techs = data.technicians.slice();
    techs.sort((a, b) => {
      const ta = threadsByTechId.get(a.id);
      const tb = threadsByTechId.get(b.id);
      const aMs = safeDateMs((ta as any)?.updated_at ?? null);
      const bMs = safeDateMs((tb as any)?.updated_at ?? null);
      if (aMs !== bMs) return bMs - aMs;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });

    return techs.map((t) => {
      const thread = threadsByTechId.get(t.id) ?? null;
      const lastMsg = thread ? lastMsgByThreadId.get(thread.id) ?? null : null;
      const lastReadAt = thread ? readsByThreadId.get(thread.id) ?? null : null;
      const isUnread =
        !!thread &&
        !!lastMsg &&
        lastMsg.sender_user_id !== user?.id &&
        safeDateMs(lastMsg.created_at) > safeDateMs(lastReadAt);
      return { tech: t, thread, lastMsg, isUnread };
    });
  }, [data.technicians, lastMsgByThreadId, readsByThreadId, threadsByTechId, user?.id]);

  const selectedTechName = React.useMemo(() => {
    if (!selectedThread) return null;
    const tech = techniciansById.get(selectedThread.technician_id);
    return tech?.name ?? "Technician";
  }, [selectedThread, techniciansById]);

  if (!gate.hasFeature("customer_portal")) {
    return <UpgradePrompt feature="Messages" requiredTier="pro" currentTier={gate.tier} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        subtitle="Chat with technicians in real time (best-effort)."
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="bg-card/70 backdrop-blur-sm lg:col-span-4 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Technicians
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingThreads ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <ScrollArea className="h-[70vh]">
                <div className="p-2 space-y-1">
                  {rows.map((r) => {
                    const active = r.thread?.id && r.thread.id === selectedThreadId;
                    const preview = r.lastMsg?.body ? r.lastMsg.body : r.thread ? "No messages yet" : "Start chat";
                    const when = r.lastMsg?.created_at ? formatDistanceToNowStrict(new Date(r.lastMsg.created_at), { addSuffix: true }) : null;
                    return (
	                      <button
	                        key={r.tech.id}
	                        className={cn(
	                          "w-full rounded-md px-3 py-2 text-left hover:bg-muted/50 transition-colors",
	                          active ? "bg-primary/10" : "",
	                        )}
                          disabled={openingTechId === r.tech.id}
	                        onClick={async () => {
                            try {
                              setOpeningTechId(r.tech.id);
    	                          const thread = await ensureThreadForTech(r.tech.id);
    	                          if (!thread) return;
    	                          setSelectedThreadId(thread.id);
    	                          setSearchParams({ thread: thread.id });
                            } finally {
                              setOpeningTechId(null);
                            }
	                        }}
	                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{r.tech.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{preview}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            {when ? <div className="text-[11px] text-muted-foreground">{when}</div> : null}
                            {r.isUnread ? <div className="mt-1 h-2 w-2 rounded-full bg-primary inline-block" /> : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/70 backdrop-blur-sm lg:col-span-8 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {selectedTechName ? `Chat — ${selectedTechName}` : "Select a technician"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!selectedThreadId ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Pick a technician to start chatting.</div>
            ) : (
	              <div className="flex flex-col h-[70vh]">
                  <div className="relative flex-1">
		                <ScrollArea className="h-full px-4">
		                  {loadingMessages ? (
		                    <div className="py-10 text-center text-sm text-muted-foreground">Loading messages…</div>
		                  ) : messages.length === 0 ? (
		                    <div className="py-10 text-center text-sm text-muted-foreground">No messages yet.</div>
		                  ) : (
	                    <div className="py-4 space-y-3">
	                      {messages.map((m) => {
	                        const mine = m.sender_user_id === user?.id;
                          const status = m._status ?? null;
                          const canResend = status === "failed";
	                        return (
	                          <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
	                            <div
	                              className={cn(
	                                "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed border",
	                                mine ? "bg-primary text-primary-foreground border-primary/30" : "bg-background/60",
	                              )}
	                                onClick={() => {
	                                  if (canResend) resendFailed(m);
	                                }}
                                onKeyDown={(e) => {
                                  if (!canResend) return;
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    resendFailed(m);
                                  }
                                }}
	                                role={canResend ? "button" : undefined}
	                                tabIndex={canResend ? 0 : undefined}
	                            >
	                              <div className="whitespace-pre-wrap break-words">{m.body}</div>
	                              <div className={cn("mt-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                  {status === "sending"
                                    ? "Sending…"
                                    : status === "failed"
                                      ? "Failed to send (tap to resend)"
                                      : formatDistanceToNowStrict(new Date(m.created_at), { addSuffix: true })}
	                              </div>
	                            </div>
	                          </div>
	                        );
	                      })}
	                    </div>
	                  )}
	                    {othersTyping ? (
	                      <div className="pb-4">
	                        <TypingBubble align="left" label="Typing" />
	                      </div>
	                    ) : null}
		                </ScrollArea>
                    {!autoScrollEnabled && hasNewBelow ? (
                      <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
                        <Button
                          size="sm"
                          className="pointer-events-auto shadow"
                          onClick={() => {
                            autoScrollRef.current = true;
                            setAutoScrollEnabled(true);
                            setHasNewBelow(false);
                            setTimeout(() => {
                              scrollToBottom();
                              updateAutoScroll();
                            }, 0);
                          }}
                        >
                          New messages
                        </Button>
                      </div>
                    ) : null}
                  </div>

                <Separator />

                <div className="p-3 flex items-end gap-2">
	                  <Input
	                    value={draft}
	                    onChange={(e) => {
                        setDraft(e.target.value);
                        bumpTyping();
                      }}
	                    placeholder="Type a message…"
	                    onKeyDown={(e) => {
	                      if (e.key === "Enter" && !e.shiftKey) {
	                        e.preventDefault();
	                        void send();
	                      }
	                    }}
                      onBlur={() => stopTyping()}
	                    disabled={sending}
	                  />
	                  <Button onClick={() => void send()} disabled={sending || draft.trim().length === 0}>
	                    <Send className="h-4 w-4 mr-2" />
	                    Send
	                  </Button>
                </div>
                <div className="px-3 pb-3 text-[11px] text-muted-foreground">
                  Messages sync live when both sides have the app open. Technicians also receive a notification entry on send.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
