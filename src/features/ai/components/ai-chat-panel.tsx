import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Sparkles, Trash2, X } from "lucide-react";
import type { AiChatMessage } from "@/features/ai/hooks/use-ai-assistant-chat";
import { useNavigate } from "react-router-dom";

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted/50 border border-border/40 rounded-bl-md",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function AiChatPanel({
  title = "AI Assistant",
  subtitle,
  messages,
  loading,
  draft,
  setDraft,
  onSend,
  onClear,
  onClose,
  quickPrompts,
  onAction,
  className,
}: {
  title?: string;
  subtitle?: string;
  messages: AiChatMessage[];
  loading: boolean;
  draft: string;
  setDraft: (v: string) => void;
  onSend: (text: string) => void | Promise<void>;
  onClear?: () => void;
  onClose?: () => void;
  quickPrompts?: string[];
  onAction?: (action: NonNullable<AiChatMessage["actions"]>[number]) => void;
  className?: string;
}) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, loading]);

  const canSend = !loading && draft.trim().length > 0;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Compact header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-2.5 bg-card/80 backdrop-blur shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate leading-tight">{title}</div>
            {subtitle ? <div className="text-[10px] text-muted-foreground truncate">{subtitle}</div> : null}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onClear ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClear}
              disabled={loading || messages.length === 0}
              aria-label="Clear chat"
              title="Clear chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-3 pb-2">
          {messages.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">How can I help?</p>
              <p className="text-xs text-muted-foreground max-w-[240px]">
                Ask for insights, recommendations, or drafts based on your dashboard data.
              </p>
            </div>
          ) : null}

          {messages.map((m, idx) => (
            <Bubble key={idx} role={m.role}>
              <div className="space-y-2">
                {m.role === "assistant" ? (
                  <div className="whitespace-pre-wrap">{m.text}</div>
                ) : (
                  <div className="whitespace-pre-wrap">{m.text}</div>
                )}
                {m.role === "assistant" && m.actions && m.actions.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {m.actions.map((a) => (
                      <Button
                        key={a.to}
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-6 text-[11px] px-2"
                        onClick={() => (onAction ? onAction(a) : navigate(a.to))}
                      >
                        {a.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </Bubble>
          ))}
          {loading ? (
            <Bubble role="assistant">
              <span className="inline-flex items-center gap-2 text-muted-foreground text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </span>
            </Bubble>
          ) : null}
        </div>
      </div>

      {/* Quick prompts - shown inline below messages when empty */}
      {quickPrompts && quickPrompts.length > 0 && messages.length === 0 ? (
        <div className="px-4 pb-2 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.slice(0, 4).map((p) => (
              <Button
                key={p}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto py-1.5 px-2.5 text-[11px] leading-tight text-muted-foreground hover:text-foreground whitespace-normal text-left"
                onClick={() => setDraft(p)}
                disabled={loading}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Input area */}
      <div className="border-t border-border/40 bg-card/80 backdrop-blur px-3 py-2.5 shrink-0 pb-[max(env(safe-area-inset-bottom),0.625rem)]">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask FieldFlow AI…"
            className="min-h-[40px] max-h-[120px] resize-none bg-background text-sm rounded-xl"
            rows={1}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!canSend) return;
                const text = draft;
                setDraft("");
                void onSend(text);
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 rounded-xl gradient-bg hover:opacity-90 shrink-0"
            disabled={!canSend}
            onClick={() => {
              const text = draft;
              setDraft("");
              void onSend(text);
            }}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
