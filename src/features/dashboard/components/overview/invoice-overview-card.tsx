import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatZarFromCents } from "@/lib/money";
import { Settings2, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import * as React from "react";

type Invoice = Tables<"invoices">;

type StatusRow = {
  label: string;
  count: number;
  totalCents: number;
  color: string;
  maxCount: number;
};

export function InvoiceOverviewCard({ invoices }: { invoices: Invoice[] }) {
  const rows: StatusRow[] = React.useMemo(() => {
    const groups: Record<string, { count: number; totalCents: number }> = {
      overdue: { count: 0, totalCents: 0 },
      unpaid: { count: 0, totalCents: 0 },
      partial: { count: 0, totalCents: 0 },
      paid: { count: 0, totalCents: 0 },
      draft: { count: 0, totalCents: 0 },
    };

    for (const inv of invoices) {
      const remaining = inv.total_cents - (inv.amount_paid_cents ?? 0);
      if (inv.status === "paid" || remaining <= 0) {
        groups.paid.count++;
        groups.paid.totalCents += inv.total_cents;
      } else if (inv.status === "draft") {
        groups.draft.count++;
        groups.draft.totalCents += inv.total_cents;
      } else if (inv.sent_at && new Date(inv.sent_at) < new Date(Date.now() - 30 * 86400000)) {
        groups.overdue.count++;
        groups.overdue.totalCents += remaining;
      } else if ((inv.amount_paid_cents ?? 0) > 0) {
        groups.partial.count++;
        groups.partial.totalCents += remaining;
      } else {
        groups.unpaid.count++;
        groups.unpaid.totalCents += remaining;
      }
    }

    const maxCount = Math.max(
      groups.overdue.count,
      groups.unpaid.count,
      groups.partial.count,
      groups.paid.count,
      groups.draft.count,
      1,
    );

    return [
      { label: "Overdue", ...groups.overdue, color: "hsl(var(--chart-2))", maxCount },
      { label: "Not Paid", ...groups.unpaid, color: "hsl(var(--destructive))", maxCount },
      { label: "Partially Paid", ...groups.partial, color: "hsl(var(--chart-1))", maxCount },
      { label: "Fully Paid", ...groups.paid, color: "hsl(var(--chart-3))", maxCount },
      { label: "Draft", ...groups.draft, color: "hsl(var(--chart-5))", maxCount },
    ];
  }, [invoices]);

  return (
    <Card className="shadow-sm border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
          <span>Invoice Overview</span>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0">
              <Link to="/dashboard/invoices">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground font-medium">{row.label}</span>
              <span className="text-muted-foreground">
                {row.count} | {formatZarFromCents(row.totalCents)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${row.maxCount > 0 ? (row.count / row.maxCount) * 100 : 0}%`,
                  backgroundColor: row.color,
                  minWidth: row.count > 0 ? "8px" : "0px",
                }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
