import * as React from "react";

type OpenArgs = {
  /** Optional draft message to prefill */
  prompt?: string;
};

type AiAssistContextValue = {
  open: boolean;
  draft: string;
  openAssist: (args?: OpenArgs) => void;
  closeAssist: () => void;
  setDraft: (next: string) => void;
};

const AiAssistContext = React.createContext<AiAssistContextValue | null>(null);

export function AiAssistProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  const openAssist = React.useCallback((args?: OpenArgs) => {
    if (args?.prompt) setDraft(args.prompt);
    setOpen(true);
  }, []);

  const closeAssist = React.useCallback(() => setOpen(false), []);

  const value = React.useMemo<AiAssistContextValue>(() => ({
    open,
    draft,
    openAssist,
    closeAssist,
    setDraft,
  }), [closeAssist, draft, open, openAssist]);

  return <AiAssistContext.Provider value={value}>{children}</AiAssistContext.Provider>;
}

export function useAiAssist() {
  const ctx = React.useContext(AiAssistContext);
  if (!ctx) throw new Error("useAiAssist must be used within AiAssistProvider");
  return ctx;
}

