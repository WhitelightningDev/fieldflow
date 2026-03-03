import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/features/dashboard/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import JobStatusBadge from "@/features/dashboard/components/job-status-badge";
import { formatZarFromCents } from "@/lib/money";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

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
  "callout-requested": { label: "Call-out requested", variant: "secondary" },
  "callout-paid": { label: "Call-out paid", variant: "default" },
  "callout-declined": { label: "Call-out declined", variant: "destructive" },
  won: { label: "Won", variant: "default" },
  lost: { label: "Lost", variant: "destructive" },
};

function statusBadge(status: string) {
  const s = String(status ?? "new");
  const opt = STATUS_MAP[s] ?? { label: s || "New", variant: "outline" as const };
  return <Badge variant={opt.variant}>{opt.label}</Badge>;
}

function calloutBadge(status: string) {
  const s = String(status ?? "").toLowerCase();
  if (s === "requested") return <Badge variant="secondary">Call-out: action required</Badge>;
  if (s === "paid") return <Badge variant="default">Call-out paid</Badge>;
  if (s === "declined") return <Badge variant="destructive">Call-out declined</Badge>;
  if (s === "cancelled") return <Badge variant="outline">Call-out cancelled</Badge>;
  return <Badge variant="outline">{s}</Badge>;
}

function invoiceBadge(status: string) {
  const s = String(status ?? "").toLowerCase();
  if (!s) return null;
  if (s === "paid") return <Badge variant="default">Invoice paid</Badge>;
  if (s === "partial") return <Badge variant="secondary">Invoice part-paid</Badge>;
  return <Badge variant="outline">Invoice {s}</Badge>;
}

export default function MyQuotes() {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
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
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter((row) => {
      const blob = [
        row.company_name,
        row.trade,
        row.status,
        row.message,
        row.callout_status,
        row.job_status,
        row.technician_name,
        row.invoice_number,
        row.invoice_status,
      ]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ");
      return blob.includes(q);
    });
  }, [quotes, query]);

  return (
    <div className="space-y-6">
      <PageHeader title="My Quotes" subtitle="Track the status of your quote requests." />

      <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quote requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company, trade, status, invoice…"
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : isError ? (
            <div className="text-sm text-muted-foreground">
              Couldn’t load your quote requests. Please try again.
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No quote requests found.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map((q) => {
                const actionRequired = q.callout_status === "requested";
                return (
                  <Card
                    key={q.id}
                    className="border-border/60 hover:bg-muted/20 transition cursor-pointer"
                    onClick={() => navigate(`/portal/quotes/${q.id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {q.company_logo_url ? (
                            <img
                              src={q.company_logo_url}
                              alt={q.company_name ? `${q.company_name} logo` : "Company logo"}
                              className="h-9 w-9 rounded-md object-contain border border-border/60 bg-background"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-md border border-border/60 bg-muted/30" />
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{q.company_name ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">
                              {q.created_at ? format(new Date(q.created_at), "dd MMM yyyy") : "—"}
                              {q.trade ? <span className="mx-1">•</span> : null}
                              {q.trade ? <span className="capitalize">{q.trade}</span> : null}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3 text-sm">
                      <div className="flex flex-wrap gap-2 items-center">
                        {statusBadge(q.status)}
                        {q.callout_status ? calloutBadge(q.callout_status) : null}
                        {q.job_status ? <JobStatusBadge status={q.job_status as any} /> : null}
                        {q.invoice_status ? invoiceBadge(q.invoice_status) : null}
                      </div>

                      {actionRequired && typeof q.callout_total_cents === "number" ? (
                        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 flex items-center justify-between gap-3">
                          <div className="text-xs text-muted-foreground">
                            Action required: pay call-out fee
                            <div className="text-sm font-semibold text-foreground">
                              {formatZarFromCents(q.callout_total_cents)}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/portal/quotes/${q.id}`);
                            }}
                          >
                            Pay
                          </Button>
                        </div>
                      ) : null}

                      {q.technician_name ? (
                        <div className="text-xs text-muted-foreground">
                          Technician: <span className="text-foreground font-medium">{q.technician_name}</span>
                        </div>
                      ) : null}

                      <div className="text-xs text-muted-foreground">
                        {q.message?.trim() ? q.message.trim() : "—"}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
