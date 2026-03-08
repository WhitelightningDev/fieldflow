import * as React from "react";
import { Button } from "@/components/ui/button";
import { useAiAssist } from "@/features/ai/ai-assist-context";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiAssistFab({ className }: { className?: string }) {
  const { openAssist } = useAiAssist();

  return (
    <div className={cn(
      "fixed z-50 transition-all",
      // Position above bottom nav on mobile, bottom-right on desktop
      "bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 xl:bottom-6 xl:right-6",
      className,
    )}>
      <Button
        type="button"
        className="h-11 w-11 rounded-full p-0 shadow-lg gradient-bg hover:opacity-90 hover:shadow-xl transition-all hover:scale-105"
        onClick={() => openAssist()}
        aria-label="Open AI Assistant"
        title="Open AI Assistant"
      >
        <Sparkles className="h-4.5 w-4.5" />
      </Button>
    </div>
  );
}
