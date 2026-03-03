import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/features/dashboard/components/page-header";
import JobStatusBadge from "@/features/dashboard/components/job-status-badge";
import { supabase } from "@/integrations/supabase/client";
import { formatZarFromCents } from "@/lib/money";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";

type Payload = {
  quote: {
    id: string;
    company_id: string;
    company_name: string | null;
    company_logo_url: string | null;
    name: string;
    email: string;
    phone: string | null;
    trade: string | null;
    address: string | null;
    message: string | null;
    status: string;
    created_at: string;
    job_card_id: string | null;
  };
  callout:
    | {
        id: string;
        status: "requested" | "paid" | "declined" | "cancelled" | string;
        callout_fee_cents: number;
        vat_percent: number;
        total_cents: number;
        requested_at: string;
        paid_at: string | null;
        payment_provider: string;
        payment_reference: string | null;
        applied_invoice_id: string | null;
        applied_at: string | null;
      }
    | null;
  job:
    | {
        id: string;
        status: "new" | "scheduled" | "in-progress" | "completed" | "invoiced" | "cancelled" | string;
        scheduled_at: string | null;
        technician_id: string | null;
        technician_name: string | null;
        title: string;
        description: string | null;
        updated_at: string;
      }
    | null;
  invoice:
    | {
        id: string;
        invoice_number: string;
        status: string;
        line_items: unknown;
        subtotal_cents: number;
        vat_percent: number;
        vat_cents: number;
        total_cents: number;
        amount_paid_cents: number;
        created_at: string;
        sent_at: string | null;
        warranty_expires_at: string | null;
        warranty_terms: string | null;
      }
    | null;
};

function parseLineItems(v: unknown): Array<{ description: string; amount_cents: number }> {
  if (!Array.isArray(v)) return [];
  const out: Array<{ description: string; amount_cents: number }> = [];
  for (const row of v) {
    const desc = String((row as any)?.description ?? "").trim();
    const amt = (row as any)?.amount_cents;
    const amount = typeof amt === "number" && Number.isFinite(amt) ? amt : Number.parseInt(String(amt ?? ""), 10);
    if (!desc || !Number.isFinite(amount)) continue;
    out.push({ description: desc, amount_cents: amount });
  }
  return out;
}

function calloutBadgeText(status: string) {
  const s = String(status ?? "").toLowerCase().trim();
  if (s === "requested") return "Call-out fee requested";
  if (s === "paid") return "Call-out paid";
  if (s === "declined") return "Call-out declined";
  if (s === "cancelled") return "Call-out cancelled";
  return s || "—";
}

function isMissingRpcFunctionError(err: unknown) {
  const code = String((err as any)?.code ?? "");
  const message = String((err as any)?.message ?? "");
  return (
    code === "PGRST202" ||
    message.includes("Could not find the function") ||
    message.includes("get_my_quote_request_detail")
  );
}

export default function QuoteDetail() {
  const { quoteRequestId } = useParams();
  const navigate = useNavigate();

  const {
    data,
    isLoading,
    isError,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["portal_quote_request_detail", quoteRequestId],
    enabled: Boolean(quoteRequestId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_quote_request_detail" as any, {
        _quote_request_id: quoteRequestId!,
      });
      if (!error) return data as Payload;

      if (isMissingRpcFunctionError(error)) {
        const fallback = await supabase.rpc("get_my_quote_requests" as any);
        if (fallback.error) throw error;
        const row = ((fallback.data ?? []) as any[]).find((r) => String(r?.id) === String(quoteRequestId));
        if (!row) throw error;

        return {
          quote: {
            id: String(row.id),
            company_id: "",
            company_name: row.company_name ?? null,
            company_logo_url: row.company_logo_url ?? null,
            name: "",
            email: "",
            phone: null,
            trade: row.trade ?? null,
            address: null,
            message: row.message ?? null,
            status: String(row.status ?? ""),
            created_at: String(row.created_at ?? ""),
            job_card_id: row.job_card_id ?? null,
          },
          callout: null,
          job: row.job_card_id
            ? {
                id: String(row.job_card_id),
                status: String(row.job_status ?? ""),
                scheduled_at: row.scheduled_at ?? null,
                technician_id: null,
                technician_name: row.technician_name ?? null,
                title: "Job",
                description: null,
                updated_at: String(row.created_at ?? ""),
              }
            : null,
          invoice: null,
        } satisfies Payload;
      }

      throw error;
    },
    retry: false,
  });

  const pay = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("pay_quote_request_callout_mock" as any, { _quote_request_id: quoteRequestId! });
      if (error) throw error;
      return data as string | null;
    },
    onSuccess: async () => {
      toast({ title: "Payment successful", description: "Thanks — we’ll schedule your call-out." });
      await refetch();
    },
    onError: (e: any) => {
      toast({ title: "Payment failed", description: e?.message ?? "Could not process payment.", variant: "destructive" });
    },
  });

  const decline = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("decline_quote_request_callout" as any, { _quote_request_id: quoteRequestId! });
      if (error) throw error;
      return Boolean(data);
    },
    onSuccess: async () => {
      toast({ title: "Call-out declined" });
      await refetch();
    },
    onError: (e: any) => {
      toast({ title: "Could not decline", description: e?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  const quote = data?.quote ?? null;
  const callout = data?.callout ?? null;
  const job = data?.job ?? null;
  const invoice = data?.invoice ?? null;

  const lineItems = React.useMemo(() => parseLineItems(invoice?.line_items), [invoice?.line_items]);
  const balanceCents = invoice ? Math.max(0, (invoice.total_cents ?? 0) - (invoice.amount_paid_cents ?? 0)) : null;

  if (!quoteRequestId) {
    return (
      <div className="space-y-4">
        <PageHeader title="Quote" subtitle="Missing quote request id." />
        <Button variant="outline" onClick={() => navigate("/portal")}>Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quote details"
        subtitle={quote?.company_name ? `Tracking your request with ${quote.company_name}.` : "Tracking your quote request."}
        actions={
          <Button variant="outline" onClick={() => navigate("/portal")}>Back</Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError || !quote ? (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Couldn’t load this quote</CardTitle>
            <CardDescription>
              {String((queryError as any)?.message ?? "").trim() || "Please try again."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => void refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">Request</span>
                {quote.company_logo_url ? (
                  <img
                    src={quote.company_logo_url}
                    alt={quote.company_name ? `${quote.company_name} logo` : "Company logo"}
                    className="h-7 w-auto object-contain"
                    loading="lazy"
                  />
                ) : null}
              </CardTitle>
              <CardDescription>
                Submitted {quote.created_at ? format(new Date(quote.created_at), "dd MMM yyyy, HH:mm") : "—"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">Trade</div>
                  <div className="font-medium">{quote.trade ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="font-medium">{quote.status}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Address</div>
                  <div className="font-medium">{quote.address?.trim() ? quote.address : "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Contact</div>
                  <div className="font-medium">{quote.email.trim() ? quote.email : "—"}</div>
                </div>
              </div>
              {quote.message?.trim() ? (
                <>
                  <Separator />
                  <div>
                    <div className="text-xs text-muted-foreground">Message</div>
                    <div className="whitespace-pre-wrap">{quote.message.trim()}</div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Call-out fee</CardTitle>
              <CardDescription>
                {callout ? calloutBadgeText(callout.status) : "No call-out fee requested yet."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {callout ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-muted-foreground">Amount (incl VAT)</div>
                    <div className="font-semibold">{formatZarFromCents(callout.total_cents ?? 0)}</div>
                  </div>
                  {callout.status === "requested" ? (
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button onClick={() => pay.mutate()} disabled={pay.isPending}>
                        {pay.isPending ? "Processing…" : "Accept & Pay"}
                      </Button>
                      <Button variant="outline" onClick={() => decline.mutate()} disabled={decline.isPending || pay.isPending}>
                        {decline.isPending ? "Declining…" : "Decline"}
                      </Button>
                    </div>
                  ) : callout.status === "paid" ? (
                    <div className="text-xs text-muted-foreground">
                      Paid {callout.paid_at ? format(new Date(callout.paid_at), "dd MMM yyyy, HH:mm") : "—"}.
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-xs text-muted-foreground">
                  The business hasn’t requested a call-out fee yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Job tracking</CardTitle>
              <CardDescription>
                {job ? "Follow progress from dispatch to completion." : "A job will be created after payment."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {job ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-muted-foreground">Status</div>
                    <JobStatusBadge status={job.status as any} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-muted-foreground">Scheduled</div>
                    <div className="font-medium">
                      {job.scheduled_at ? format(new Date(job.scheduled_at), "dd MMM yyyy, HH:mm") : "Not scheduled yet"}
                    </div>
                  </div>
                  {job.technician_name ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-muted-foreground">Technician</div>
                      <div className="font-medium">{job.technician_name}</div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Once payment is confirmed, the business can dispatch a technician and you’ll see updates here.
                </div>
              )}
            </CardContent>
          </Card>

          {invoice ? (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Invoice</CardTitle>
                <CardDescription>
                  {invoice.invoice_number} • {invoice.status}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {lineItems.length > 0 ? (
                  <div className="space-y-1.5">
                    {lineItems.map((li, idx) => (
                      <div key={idx} className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{li.description}</span>
                        <span className="font-medium">{formatZarFromCents(li.amount_cents)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No line items saved.</div>
                )}

                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatZarFromCents(invoice.subtotal_cents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT ({invoice.vat_percent}%)</span>
                  <span>{formatZarFromCents(invoice.vat_cents)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatZarFromCents(invoice.total_cents)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid</span>
                  <span>{formatZarFromCents(invoice.amount_paid_cents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance</span>
                  <span className={balanceCents && balanceCents > 0 ? "font-medium text-destructive" : "font-medium"}>
                    {balanceCents === null ? "—" : formatZarFromCents(balanceCents)}
                  </span>
                </div>

                {invoice.warranty_expires_at || invoice.warranty_terms ? (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <div className="text-xs font-medium">Warranty</div>
                      {invoice.warranty_expires_at ? (
                        <div className="text-xs text-muted-foreground">
                          Valid until {format(new Date(invoice.warranty_expires_at), "dd MMM yyyy")}
                        </div>
                      ) : null}
                      {invoice.warranty_terms?.trim() ? (
                        <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {invoice.warranty_terms.trim()}
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
