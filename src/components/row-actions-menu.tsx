import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";
import * as React from "react";

export default function RowActionsMenu({
  children,
  align = "end",
  side = "bottom",
  label = "Open actions",
  className,
  triggerClassName,
}: {
  children: React.ReactNode;
  align?: React.ComponentProps<typeof DropdownMenuContent>["align"];
  side?: React.ComponentProps<typeof DropdownMenuContent>["side"];
  label?: string;
  className?: string;
  triggerClassName?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9", triggerClassName)}
          aria-label={label}
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className={className}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

