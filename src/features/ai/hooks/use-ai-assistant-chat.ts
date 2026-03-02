import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { toastError } from "@/lib/toast-helpers";

export type AiChatMessage = { role: "user" | "assistant"; text: string };

export function useAiAssistantChat({
  enabled,
  context,
}: {
  enabled: boolean;
  context: string;
}) {
  const [messages, setMessages] = React.useState<AiChatMessage[]>([]);
  const [loading, setLoading] = React.useState(false);

  const clear = React.useCallback(() => setMessages([]), []);

  const send = React.useCallback(async (text: string) => {
    const message = text.trim();
    if (!message) return;
    if (!enabled) {
      toastError("AI request blocked", "Your plan or role does not allow AI access.");
      return;
    }

    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setLoading(true);

    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("ai-assistant", {
        body: { message, context },
      });

      if (fnError) {
        let details = fnError.message;
        const ctx: any = (fnError as any).context;
        const res: Response | undefined = ctx?.response;
        if (res) {
          try {
            const raw = await res.text();
            const parsed = raw ? JSON.parse(raw) : null;
            details = parsed?.error ?? parsed?.hint ?? raw ?? details;
          } catch {
            // ignore
          }
          if (res.status === 404) details = 'Edge function "ai-assistant" is not deployed.';
        }
        toastError("AI request failed", details);
        setMessages((prev) => [...prev, { role: "assistant", text: "Sorry — I couldn’t complete that request." }]);
        return;
      }

      const out = (fnData as any)?.text as string | undefined;
      setMessages((prev) => [...prev, { role: "assistant", text: out?.trim() || "No response." }]);
    } catch (e: any) {
      toastError("AI request failed", e?.message ?? "Unknown error");
      setMessages((prev) => [...prev, { role: "assistant", text: "Sorry — I couldn’t complete that request." }]);
    } finally {
      setLoading(false);
    }
  }, [context, enabled]);

  return { messages, loading, send, clear };
}

