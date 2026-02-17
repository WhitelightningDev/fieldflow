import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { MessageSquare, Send } from "lucide-react";
import * as React from "react";
import { useSearchParams } from "react-router-dom";

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

function safeDateMs(v: string | null | undefined) {
  const ms = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(ms) ? ms : 0;
}

export default function TechMessages() {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();

  const [technicianId, setTechnicianId] = React.useState<string | null>(null);
  const [thread, setThread] = React.useState<ChatThread | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const sendingRef = React.useRef(false);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const companyId = profile?.company_id ?? null;

  const scrollToBottom = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const markRead = React.useCallback(async (threadId: string) => {
    if (!user?.id) return;
    const nowIso = new Date().toISOString();
    await supabase
      .from("chat_thread_reads")
      .upsert({ thread_id: threadId, user_id: user.id, last_read_at: nowIso } as any, { onConflict: "thread_id,user_id" });
  }, [user?.id]);

	  const ensureThread = React.useCallback(async (techId: string) => {
	    if (!companyId) return null;
	    const explicitThreadId = searchParams.get("thread");

	    if (explicitThreadId) {
      const { data: t, error } = await supabase
        .from("chat_threads")
        .select("id,company_id,technician_id,created_at,updated_at")
        .eq("id", explicitThreadId)
        .maybeSingle();
      if (!error && t) return t as ChatThread;
    }

    const { data: existing, error: existingErr } = await supabase
      .from("chat_threads")
      .select("id,company_id,technician_id,created_at,updated_at")
      .eq("company_id", companyId)
      .eq("technician_id", techId)
      .maybeSingle();
	    if (!existingErr && existing) return existing as ChatThread;

	    const { data: created, error: createErr } = await supabase
	      .from("chat_threads")
	      .upsert({ company_id: companyId, technician_id: techId } as any, { onConflict: "company_id,technician_id" })
	      .select("id,company_id,technician_id,created_at,updated_at")
	      .single();
	    if (createErr || !created) {
	      // Fallback: try select again, then toast error so it's not "silent".
	      const { data: retry, error: retryErr } = await supabase
	        .from("chat_threads")
	        .select("id,company_id,technician_id,created_at,updated_at")
	        .eq("company_id", companyId)
	        .eq("technician_id", techId)
	        .maybeSingle();
	      if (!retryErr && retry) return retry as ChatThread;
	      toast({
	        title: "Chat unavailable",
	        description: (createErr ?? retryErr)?.message ?? "Chat thread could not be created or loaded.",
	        variant: "destructive",
	      });
	      return null;
	    }
	    return created as ChatThread;
	  }, [companyId, searchParams]);

  const load = React.useCallback(async () => {
    if (!user?.id || !companyId) return;
    setLoading(true);

	    const { data: tech, error: techErr } = await supabase
	      .from("technicians")
	      .select("id")
	      .eq("user_id", user.id)
	      .maybeSingle();
	    if (techErr || !tech?.id) {
	      toast({ title: "Could not load technician", description: techErr?.message ?? "No technician profile linked to this account.", variant: "destructive" });
	      setLoading(false);
	      return;
	    }
    setTechnicianId(tech.id);

    const t = await ensureThread(tech.id);
    if (!t) {
      setThread(null);
      setMessages([]);
      setLoading(false);
      return;
    }
    setThread(t);

    const { data: rows, error } = await supabase
      .from("chat_messages")
      .select("id,thread_id,company_id,sender_user_id,body,created_at")
      .eq("thread_id", t.id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (!error) setMessages((rows ?? []) as ChatMessage[]);

    setLoading(false);
    setTimeout(scrollToBottom, 0);
    void markRead(t.id);
  }, [companyId, ensureThread, markRead, scrollToBottom, user?.id]);

  const send = React.useCallback(async () => {
    if (!user?.id || !companyId || !thread?.id) return;
    const body = draft.trim();
    if (!body) return;
    if (sendingRef.current) return;

    sendingRef.current = true;
    setSending(true);
    try {
      const optimistic: ChatMessage = {
        id: `optimistic:${Date.now()}`,
        thread_id: thread.id,
        company_id: companyId,
        sender_user_id: user.id,
        body,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setDraft("");
      setTimeout(scrollToBottom, 0);

      const { data: inserted, error } = await supabase
        .from("chat_messages")
        .insert({ thread_id: thread.id, company_id: companyId, sender_user_id: user.id, body } as any)
        .select("id,thread_id,company_id,sender_user_id,body,created_at")
        .single();

      if (error || !inserted) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        return;
      }

      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimistic.id);
        const nextInserted = inserted as ChatMessage;
        if (withoutOptimistic.some((m) => m.id === nextInserted.id)) return withoutOptimistic;
        return [...withoutOptimistic, nextInserted];
      });
      await markRead(thread.id);
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  }, [companyId, draft, markRead, scrollToBottom, thread?.id, user?.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!companyId || !thread?.id) return;
    const channel = supabase
      .channel(`chat-thread:${thread.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${thread.id}` },
        (payload: any) => {
          const row = payload?.new as ChatMessage | undefined;
          if (!row?.id) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row].sort((a, b) => safeDateMs(a.created_at) - safeDateMs(b.created_at));
          });
          setTimeout(scrollToBottom, 0);
          try {
            if (document.visibilityState === "visible") void markRead(thread.id);
          } catch {
            // ignore
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, markRead, scrollToBottom, thread?.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-muted-foreground text-sm">Chat with the office/admin.</p>
      </div>

      <Card className="bg-card/70 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Office chat
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
          ) : !technicianId ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No technician profile linked to this account.</div>
          ) : !thread ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Chat unavailable.</div>
          ) : (
            <div className="flex flex-col h-[70vh]">
              <ScrollArea className="flex-1 px-4" viewportRef={scrollRef}>
                {messages.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">No messages yet.</div>
                ) : (
                  <div className="py-4 space-y-3">
                    {messages.map((m) => {
                      const mine = m.sender_user_id === user?.id;
                      return (
                        <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                          <div
                            className={cn(
                              "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed border",
                              mine ? "bg-primary text-primary-foreground border-primary/30" : "bg-background/60",
                            )}
                          >
                            <div className="whitespace-pre-wrap break-words">{m.body}</div>
                            <div className={cn("mt-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                              {formatDistanceToNowStrict(new Date(m.created_at), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              <Separator />

              <div className="p-3 flex items-end gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  disabled={sending}
                />
                <Button onClick={() => send()} disabled={sending || draft.trim().length === 0}>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </div>
              <div className="px-3 pb-3 text-[11px] text-muted-foreground">
                Messages sync live when both sides have the app open.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
