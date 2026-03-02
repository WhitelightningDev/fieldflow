import * as React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useAiAssist } from "@/features/ai/ai-assist-context";

export function AiAssistTrigger({
  prompt,
  label = "Ask AI",
  variant = "outline",
  size = "sm",
}: {
  prompt?: string;
  label?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const { openAssist } = useAiAssist();
  return (
    <Button type="button" variant={variant} size={size} onClick={() => openAssist({ prompt })}>
      <Sparkles className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
}

