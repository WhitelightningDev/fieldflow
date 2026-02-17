import * as React from "react";
import { cn } from "@/lib/utils";

export default function TypingBubble({
  align = "left",
  label,
}: {
  align?: "left" | "right";
  label?: string;
}) {
  return (
    <div className={cn("flex", align === "right" ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm border", align === "right" ? "bg-primary/10" : "bg-background/60")}>
        <div className="flex items-center gap-2">
          {label ? <span className="text-xs text-muted-foreground">{label}</span> : null}
          <span className="inline-flex items-end gap-1 leading-none">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "120ms" }} />
            <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "240ms" }} />
          </span>
        </div>
      </div>
    </div>
  );
}

