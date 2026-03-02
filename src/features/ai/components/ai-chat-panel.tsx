import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import type { AiChatMessage } from "@/features/ai/hooks/use-ai-assistant-chat";

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap border",
          isUser
            ? "bg-primary text-primary-foreground border-primary/40"
            : "bg-background/70 border-border/60",
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
  quickPrompts,
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
  quickPrompts?: string[];
  className?: string;
}) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, loading]);

  const canSend = !loading && draft.trim().length > 0;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3 bg-background/70 backdrop-blur">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="font-semibold truncate">{title}</div>
          </div>
          {subtitle ? <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
        {onClear ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClear}
            disabled={loading || messages.length === 0}
            aria-label="Clear chat"
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {quickPrompts && quickPrompts.length > 0 && messages.length === 0 ? (
        <div className="px-4 pt-3">
          <div className="text-xs text-muted-foreground mb-2">Try a quick prompt:</div>
          <div className="flex flex-wrap gap-2">
            {quickPrompts.slice(0, 6).map((p) => (
              <Button
                key={p}
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setDraft(p)}
                disabled={loading}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3 pb-2">
          {messages.length === 0 ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
              Ask for insights like: “What should I focus on today?” or “Draft an invoice follow-up message.”
            </div>
          ) : null}
          {messages.map((m, idx) => (
            <Bubble key={idx} role={m.role}>
              {m.text}
            </Bubble>
          ))}
          {loading ? (
            <Bubble role="assistant">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
              </span>
            </Bubble>
          ) : null}
        </div>
      </div>

      <div className="border-t border-border/60 bg-background/70 backdrop-blur px-4 py-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask FieldFlow AI…"
            className="min-h-[44px] max-h-[140px] resize-none bg-background"
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
            className="h-[44px] gradient-bg hover:opacity-90 shadow-glow"
            disabled={!canSend}
            onClick={() => {
              const text = draft;
              setDraft("");
              void onSend(text);
            }}
          >
            Send
          </Button>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">
          Tip: Press <span className="font-medium">Enter</span> to send, <span className="font-medium">Shift+Enter</span> for a new line.
        </div>
      </div>
    </div>
  );
}
