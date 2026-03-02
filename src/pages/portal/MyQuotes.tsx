import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/features/dashboard/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import JobStatusBadge from "@/features/dashboard/components/job-status-badge";
import { formatZarFromCents } from "@/lib/money";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

type MyQuoteRow = {
  id: string;
  company_name: string | null;
  company_logo_url: string | null;
  trade: string | null;
  message: string | null;
  status: string;
  created_at: string;
  callout_status: string | null;
  callout_total_cents: number | null;
  callout_requested_at: string | null;
  callout_paid_at: string | null;
  job_card_id: string | null;
  job_status: "new" | "scheduled" | "in-progress" | "completed" | "invoiced" | "cancelled" | null;
  scheduled_at: string | null;
  technician_name: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  invoice_status: string | null;
  invoice_total_cents: number | null;
  invoice_amount_paid_cents: number | null;
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
  const navigate = useNavigate();
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
                    <TableHead>Call-out</TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((q) => (
                    <TableRow
                      key={q.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => navigate(`/portal/quotes/${q.id}`)}
                    >
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
                      <TableCell>
                        {q.callout_status ? (
                          <div className="space-y-1">
                            <Badge variant={q.callout_status === "paid" ? "default" : q.callout_status === "requested" ? "secondary" : "outline"} className="text-[10px]">
                              {q.callout_status}
                            </Badge>
                            {q.callout_status === "requested" && typeof q.callout_total_cents === "number" ? (
                              <div className="text-xs text-muted-foreground">
                                Action required: {formatZarFromCents(q.callout_total_cents)}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {q.job_status ? (
                          <div className="space-y-1">
                            <JobStatusBadge status={q.job_status as any} />
                            {q.technician_name ? (
                              <div className="text-xs text-muted-foreground truncate">{q.technician_name}</div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {q.invoice_number ? (
                          <div className="space-y-1">
                            <div className="font-medium">{q.invoice_number}</div>
                            {q.invoice_status ? (
                              <Badge variant={q.invoice_status === "paid" ? "default" : q.invoice_status === "partial" ? "secondary" : "outline"} className="text-[10px]">
                                {q.invoice_status}
                              </Badge>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
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
