import * as React from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FileText, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import type { QuoteRequest } from "./quote-requests-table";

type KpiItem = {
  label: string;
  value: number;
  icon: React.ElementType;
  accent: string;
  iconBg: string;
};

export function QuoteRequestsKpi({ quotes, isLoading }: { quotes: QuoteRequest[] | undefined; isLoading: boolean }) {
  const stats = React.useMemo<KpiItem[]>(() => {
    const all = quotes ?? [];
    return [
      {
        label: "Total",
        value: all.length,
        icon: FileText,
        accent: "border-l-primary/60",
        iconBg: "bg-primary/10 text-primary",
      },
      {
        label: "New",
        value: all.filter((q) => q.status === "new").length,
        icon: Clock,
        accent: "border-l-[hsl(38_92%_50%)]",
        iconBg: "bg-[hsl(38_92%_50%/0.1)] text-[hsl(38_92%_40%)] dark:text-[hsl(38_92%_65%)]",
      },
      {
        label: "Won",
        value: all.filter((q) => q.status === "won" || q.status === "callout-paid").length,
        icon: CheckCircle2,
        accent: "border-l-[hsl(142_71%_45%)]",
        iconBg: "bg-[hsl(142_71%_45%/0.1)] text-[hsl(142_71%_35%)] dark:text-[hsl(142_71%_60%)]",
      },
      {
        label: "Needs action",
        value: all.filter((q) => q.status === "new" || q.status === "callout-requested").length,
        icon: AlertTriangle,
        accent: "border-l-destructive",
        iconBg: "bg-destructive/10 text-destructive",
      },
    ];
  }, [quotes]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-l-[3px] border-l-muted-foreground/20 shadow-sm rounded-xl">
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => (
        <Card
          key={s.label}
          className={cn(
            "border-l-[3px] shadow-sm rounded-xl border-border/40 transition-all hover:shadow-md",
            s.accent,
          )}
        >
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("rounded-lg p-1.5", s.iconBg)}>
                <s.icon className="h-3.5 w-3.5" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {s.label}
              </span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground">{s.value}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}
