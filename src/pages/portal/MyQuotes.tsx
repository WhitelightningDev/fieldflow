import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/features/dashboard/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

type MyQuoteRow = {
  id: string;
  company_name: string | null;
  company_logo_url: string | null;
  trade: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  new: { label: "New", variant: "secondary" },
  contacted: { label: "Contacted", variant: "secondary" },
  quoted: { label: "Quoted", variant: "default" },
  won: { label: "Won", variant: "default" },
  lost: { label: "Lost", variant: "destructive" },
};

function statusBadge(status: string) {
  const s = String(status ?? "new");
  const opt = STATUS_MAP[s] ?? { label: s || "New", variant: "outline" as const };
  return <Badge variant={opt.variant}>{opt.label}</Badge>;
}

export default function MyQuotes() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["portal_my_quote_requests"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_quote_requests" as any);
      if (error) throw error;
      return (data ?? []) as MyQuoteRow[];
    },
    retry: false,
  });

  const quotes = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="My Quotes" subtitle="Track the status of your quote requests." />

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quote requests</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isError ? (
            <div className="text-sm text-muted-foreground">
              Couldn’t load your quote requests. Please try again.
            </div>
          ) : quotes.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No quote requests yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {q.company_logo_url ? (
                            <img
                              src={q.company_logo_url}
                              alt={q.company_name ? `${q.company_name} logo` : "Company logo"}
                              className="h-7 w-7 rounded-md object-contain border border-border/60 bg-background"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-7 w-7 rounded-md border border-border/60 bg-muted/30" />
                          )}
                          <div className="font-medium">{q.company_name ?? "—"}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{q.trade ?? "—"}</TableCell>
                      <TableCell>{statusBadge(q.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {q.created_at ? format(new Date(q.created_at), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell className="max-w-[380px]">
                        <div className="text-muted-foreground truncate">
                          {q.message?.trim() ? q.message.trim() : "—"}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

