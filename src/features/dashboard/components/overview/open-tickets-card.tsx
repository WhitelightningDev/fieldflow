import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowUpRight, AlertTriangle, Users, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import * as React from "react";
import { cn } from "@/lib/utils";

type Customer = Tables<"customers">;

type TicketItem = {
  id: string;
  name: string;
  message: string;
  severity: "critical" | "warning" | "info";
  href?: string;
};

export function OpenTicketsCard({ items }: { items: TicketItem[] }) {
  const severityIcon = (s: TicketItem["severity"]) => {
    switch (s) {
      case "critical":
        return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-3.5 w-3.5 text-[hsl(38_92%_50%)]" />;
      default:
        return <CheckCircle2 className="h-3.5 w-3.5 text-primary" />;
    }
  };

  const severityBg = (s: TicketItem["severity"]) => {
    switch (s) {
      case "critical":
        return "bg-destructive/10";
      case "warning":
        return "bg-[hsl(38_92%_50%/0.1)]";
      default:
        return "bg-primary/10";
    }
  };

  return (
    <Card className="shadow-sm border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
          <span>Attention Needed</span>
          <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-primary/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">All clear — nothing needs attention</p>
          </div>
        ) : (
          <div className="space-y-0">
            {items.slice(0, 5).map((item, idx) => (
              <React.Fragment key={item.id}>
                <div className="flex items-start gap-3 py-2.5">
                  <div className={cn("mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0", severityBg(item.severity))}>
                    {severityIcon(item.severity)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.message}</p>
                  </div>
                  {item.href && (
                    <Button asChild variant="ghost" size="sm" className="h-7 text-xs shrink-0">
                      <Link to={item.href}>Check →</Link>
                    </Button>
                  )}
                </div>
                {idx < Math.min(items.length, 5) - 1 && <Separator />}
              </React.Fragment>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
