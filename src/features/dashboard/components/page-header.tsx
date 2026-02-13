import { cn } from "@/lib/utils";
import * as React from "react";

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
};

export default function PageHeader({ title, subtitle, actions, className }: Props) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        <div className="text-2xl font-bold tracking-tight">{title}</div>
        {subtitle ? <div className="text-sm text-muted-foreground mt-1">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

