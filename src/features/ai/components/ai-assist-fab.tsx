import * as React from "react";
import { Button } from "@/components/ui/button";
import { useAiAssist } from "@/features/ai/ai-assist-context";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiAssistFab({ className }: { className?: string }) {
  const { openAssist } = useAiAssist();

  return (
    <div className={cn("fixed bottom-6 right-6 z-50", className)}>
      <Button
        type="button"
        className="h-12 w-12 rounded-full p-0 shadow-xl gradient-bg hover:opacity-90"
        onClick={() => openAssist()}
        aria-label="Open AI Assistant"
        title="Open AI Assistant"
      >
        <Sparkles className="h-5 w-5" />
      </Button>
    </div>
  );
}

