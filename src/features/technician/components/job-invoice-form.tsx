import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { formatZarFromCents } from "@/lib/money";
import {
  Camera,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  MessageCircle,
  Send,
  Upload,
} from "lucide-react";
import * as React from "react";

type Props = {
  job: any;
  timeEntries: any[];
  usedParts: any[];
  companyId: string;
  technicianCostRateCents: number; // internal hourly cost (cents per hour)
  technicianBillRateCents: number; // customer-facing hourly bill rate (cents per hour)
  onInvoiceCreated?: () => void;
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "eft", label: "EFT / Bank Transfer" },
  { value: "mobile", label: "Mobile Payment" },
  { value: "other", label: "Other" },
];

export default function JobInvoiceForm({
  job,
  timeEntries,
  usedParts,
  companyId,
  technicianCostRateCents,
  technicianBillRateCents,
  onInvoiceCreated,
}: Props) {
  const [invoice, setInvoice] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [calloutFeeCents, setCalloutFeeCents] = React.useState<number>(0);
  const [calloutRadiusKm, setCalloutRadiusKm] = React.useState<number>(50);
  const [labourOverheadPct, setLabourOverheadPct] = React.useState<number>(15);

  // Payment state
  const [payMethod, setPayMethod] = React.useState("cash");
  const [payAmount, setPayAmount] = React.useState("");
  const [payRef, setPayRef] = React.useState("");
  const [proofFile, setProofFile] = React.useState<File | null>(null);
  const [recordingPay, setRecordingPay] = React.useState(false);
  const [payments, setPayments] = React.useState<any[]>([]);
  const [sending, setSending] = React.useState(false);
  const [showInternal, setShowInternal] = React.useState(false);
  const proofRef = React.useRef<HTMLInputElement>(null);

  const minutesForEntry = React.useCallback((e: any) => {
    if (typeof e?.minutes === "number") return Math.max(0, e.minutes);
    if (e?.started_at && e?.ended_at) {
      const ms = new Date(e.ended_at).getTime() - new Date(e.started_at).getTime();
      return Math.max(0, Math.round(ms / 60000));
    }
    return 0;
  }, []);

  // Calculate totals
  const totalMinutes = timeEntries.reduce((s, e) => s + minutesForEntry(e), 0);
  const labourBaseCents = Math.round((totalMinutes / 60) * technicianCostRateCents);
  const labourOverheadCents = Math.round(labourBaseCents * (labourOverheadPct / 100));
  const labourCostToCompanyCents = labourBaseCents + labourOverheadCents;
  const labourChargeRateCents = technicianBillRateCents > 0 ? technicianBillRateCents : technicianCostRateCents;
  const labourChargeCents = Math.round((totalMinutes / 60) * labourChargeRateCents);
  const partsCents = usedParts.reduce((s, p) => {
    const unitCost = p.inventory_items?.unit_cost_cents ?? 0;
    return s + unitCost * (p.quantity_used ?? 1);
  }, 0);
  const subtotal = calloutFeeCents + labourChargeCents + partsCents;
  const vatPct = 15;
  const vatCents = Math.round(subtotal * (vatPct / 100));
  const totalCents = subtotal + vatCents;
  const netProfitCents = totalCents - (partsCents + labourCostToCompanyCents);
  const netProfitForInvoiceCents = (invoice?.total_cents ?? totalCents) - (partsCents + labourCostToCompanyCents);

  // Fetch existing invoice
  React.useEffect(() => {
    supabase
      .from("invoices")
      .select("*")
      .eq("job_card_id", job.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setInvoice(data[0]);
        setLoading(false);
      });
  }, [job.id]);

  React.useEffect(() => {
    // Best-effort: load finance settings from company (older DBs may not have these columns).
    supabase
      .from("companies")
      .select("callout_fee_cents,callout_radius_km,labour_overhead_percent")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) return;
        const feeRaw = (data as any).callout_fee_cents;
        const kmRaw = (data as any).callout_radius_km;
        const pctRaw = (data as any).labour_overhead_percent;

        const fee = Math.max(0, Number.parseInt(String(feeRaw ?? "0"), 10) || 0);
        const km = Math.max(0, Number.parseFloat(String(kmRaw ?? "50")) || 50);
        const pct = Math.max(0, Number.parseFloat(String(pctRaw ?? "15")) || 15);

        setCalloutFeeCents(fee);
        setCalloutRadiusKm(km);
        setLabourOverheadPct(pct);
      });
  }, [companyId]);

  // Fetch payments
  const fetchPayments = React.useCallback(async () => {
    if (!invoice) return;
    const { data } = await supabase
      .from("invoice_payments")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("paid_at", { ascending: false });
    setPayments(data ?? []);
  }, [invoice]);

  React.useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const createInvoice = async () => {
    setCreating(true);
    // Generate invoice number
    const { data: invNum } = await supabase.rpc("generate_invoice_number", { _company_id: companyId });
    const invoiceNumber = invNum ?? `INV-${Date.now()}`;

    const lineItems = [
      ...(calloutFeeCents > 0
        ? [{ description: `Call-out fee (includes travel up to ${calloutRadiusKm}km)`, amount_cents: calloutFeeCents }]
        : []),
      ...(labourChargeCents > 0
        ? [{
            description: `Labour (${(totalMinutes / 60).toFixed(1)} hrs @ R${(labourChargeRateCents / 100).toFixed(2)}/hr)`,
            amount_cents: labourChargeCents,
          }]
        : []),
      ...usedParts.map((p) => ({
        description: `${p.inventory_items?.name ?? "Part"} x${p.quantity_used}`,
        amount_cents: (p.inventory_items?.unit_cost_cents ?? 0) * (p.quantity_used ?? 1),
      })),
    ];

    const payload = {
      company_id: companyId,
      job_card_id: job.id,
      customer_id: job.customer_id,
      invoice_number: invoiceNumber,
      status: "draft",
      labour_minutes: totalMinutes,
      labour_rate_cents: labourChargeRateCents,
      labour_total_cents: labourChargeCents,
      parts_total_cents: partsCents,
      subtotal_cents: subtotal,
      vat_percent: vatPct,
      vat_cents: vatCents,
      total_cents: totalCents,
      notes,
      line_items: lineItems,
    };

    const { data, error } = await supabase
      .from("invoices")
      .insert(payload)
      .select()
      .single();

    setCreating(false);
    if (error) {
      toast({ title: "Error creating invoice", description: error.message, variant: "destructive" });
      return;
    }
    setInvoice(data);
    // Update job status + revenue so dashboards reflect invoicing immediately.
    await supabase
      .from("job_cards")
      .update({ status: "invoiced", revenue_cents: data.total_cents } as any)
      .eq("id", job.id);
    toast({ title: "Invoice created", description: `${invoiceNumber}` });
    onInvoiceCreated?.();
  };

  const recordPayment = async () => {
    if (!invoice) return;
    setRecordingPay(true);
    let proofPath: string | null = null;

    if (proofFile) {
      const ext = proofFile.name.split(".").pop() ?? "jpg";
      const path = `${companyId}/${invoice.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, proofFile);
      if (upErr) {
        toast({ title: "Proof upload failed", description: upErr.message, variant: "destructive" });
        setRecordingPay(false);
        return;
      }
      proofPath = path;
    }

    const amountCents = Math.round(parseFloat(payAmount || "0") * 100);

    const { error } = await supabase.from("invoice_payments").insert({
      invoice_id: invoice.id,
      company_id: companyId,
      amount_cents: amountCents,
      payment_method: payMethod,
      reference: payRef || null,
      proof_storage_path: proofPath,
    });

    if (error) {
      toast({ title: "Error recording payment", description: error.message, variant: "destructive" });
      setRecordingPay(false);
      return;
    }

    // Update invoice amount_paid
    const newPaid = (invoice.amount_paid_cents ?? 0) + amountCents;
    const newStatus = newPaid >= invoice.total_cents ? "paid" : "partial";
    await supabase
      .from("invoices")
      .update({ amount_paid_cents: newPaid, status: newStatus })
      .eq("id", invoice.id);

    setInvoice((prev: any) => ({ ...prev, amount_paid_cents: newPaid, status: newStatus }));
    // Best-effort: treat job "revenue" as realised income (paid amount).
    await supabase.from("job_cards").update({ revenue_cents: newPaid } as any).eq("id", job.id);
    setRecordingPay(false);
    setPayAmount("");
    setPayRef("");
    setProofFile(null);
    fetchPayments();
    toast({ title: "Payment recorded" });
  };

  const sendInvoice = async (method: "email" | "whatsapp") => {
    if (!invoice) return;
    const customer = job.customers;

    if (method === "whatsapp") {
      const phone = customer?.phone?.replace(/\D/g, "") ?? "";
      const msg = encodeURIComponent(
        `Hi ${customer?.name ?? ""},\n\nPlease find your invoice ${invoice.invoice_number} for ${formatZarFromCents(invoice.total_cents)}.\n\nThank you!`
      );
      window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
      await supabase.from("invoices").update({ sent_at: new Date().toISOString(), status: "sent" }).eq("id", invoice.id);
      setInvoice((prev: any) => ({ ...prev, status: "sent", sent_at: new Date().toISOString() }));
      toast({ title: "Invoice shared via WhatsApp" });
      return;
    }

    // Email — mark as sent (edge function could handle actual email delivery)
    setSending(true);
    await supabase
      .from("invoices")
      .update({ sent_at: new Date().toISOString(), status: "sent" })
      .eq("id", invoice.id);
    setInvoice((prev: any) => ({ ...prev, status: "sent", sent_at: new Date().toISOString() }));
    setSending(false);
    toast({ title: "Invoice marked as sent", description: `Email to ${customer?.email ?? "client"}` });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If no invoice yet — show preview & create button
  if (!invoice) {
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" /> Invoice Preview
        </h4>

        <div className="rounded-lg border p-4 space-y-3 text-sm">
          {calloutFeeCents > 0 ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Call-out fee</span>
              <span className="font-medium">{formatZarFromCents(calloutFeeCents)}</span>
            </div>
          ) : null}
          {labourChargeCents > 0 ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Labour</span>
              <span className="font-medium">{formatZarFromCents(labourChargeCents)}</span>
            </div>
          ) : null}
          {usedParts.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-muted-foreground">
                {p.inventory_items?.name ?? "Part"} x{p.quantity_used}
              </span>
              <span className="font-medium">
                {formatZarFromCents((p.inventory_items?.unit_cost_cents ?? 0) * (p.quantity_used ?? 1))}
              </span>
            </div>
          ))}
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowInternal((v) => !v)}>
              {showInternal ? "Hide internal" : "Show internal"}
            </Button>
          </div>
          {showInternal ? (
            <div className="rounded-md border bg-muted/20 p-3 space-y-1 text-[11px] text-muted-foreground">
              <div>Internal only (not customer-facing):</div>
              <div>Labour cost-to-company is calculated from time entries using hourly cost + {labourOverheadPct}% overhead.</div>
              <div>Labour base: {formatZarFromCents(labourBaseCents)}</div>
              <div>Overhead: {formatZarFromCents(labourOverheadCents)}</div>
              <div className="font-medium text-foreground/80">Cost to company (labour + parts): {formatZarFromCents(labourCostToCompanyCents + partsCents)}</div>
            </div>
          ) : null}
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatZarFromCents(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">VAT ({vatPct}%)</span>
            <span>{formatZarFromCents(vatCents)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>{formatZarFromCents(totalCents)}</span>
          </div>
        </div>

        <Textarea
          placeholder="Invoice notes (optional)…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        <Button
          onClick={createInvoice}
          disabled={creating}
          className="w-full gradient-bg hover:opacity-90 shadow-glow gap-1.5"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {creating ? "Creating…" : "Create Invoice"}
        </Button>
      </div>
    );
  }

  // Invoice exists — show details, send, record payment
  const totalPaid = invoice.amount_paid_cents ?? 0;
  const balance = invoice.total_cents - totalPaid;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" /> {invoice.invoice_number}
        </h4>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            invoice.status === "paid"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : invoice.status === "sent"
              ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          {invoice.status}
        </span>
      </div>

      {/* Summary */}
      <div className="rounded-lg border p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total</span>
          <span className="font-bold">{formatZarFromCents(invoice.total_cents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Paid</span>
          <span className="text-emerald-600 dark:text-emerald-400">{formatZarFromCents(totalPaid)}</span>
        </div>
        {balance > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Balance</span>
            <span className="font-semibold text-destructive">{formatZarFromCents(balance)}</span>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowInternal((v) => !v)}>
          {showInternal ? "Hide internal" : "Show internal"}
        </Button>
      </div>
      {showInternal ? (
        <div className="rounded-lg border p-4 space-y-2 text-sm bg-muted/20">
          <div className="text-xs font-semibold text-muted-foreground">Internal (not customer-facing)</div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Labour base</span>
            <span>{formatZarFromCents(labourBaseCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Overhead ({labourOverheadPct}%)</span>
            <span>{formatZarFromCents(labourOverheadCents)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span className="text-muted-foreground">Cost to company (labour + parts)</span>
            <span>{formatZarFromCents(labourCostToCompanyCents + partsCents)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span className="text-muted-foreground">Net profit (if fully paid)</span>
            <span>{formatZarFromCents(netProfitForInvoiceCents)}</span>
          </div>
        </div>
      ) : null}

      {/* Send buttons */}
      {!invoice.sent_at && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => sendInvoice("email")}
            disabled={sending}
            className="flex-1 gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            Email
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => sendInvoice("whatsapp")}
            className="flex-1 gap-1.5"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </Button>
        </div>
      )}

      {/* Record Payment */}
      {balance > 0 && (
        <Card className="bg-card/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Record Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Amount (R)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={(balance / 100).toFixed(2)}
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Method</label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Input
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder="Reference (optional)"
              className="h-9"
            />
            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => proofRef.current?.click()}
                className="gap-1.5 w-full"
              >
                <Camera className="h-3.5 w-3.5" />
                {proofFile ? proofFile.name : "Upload Proof of Payment"}
              </Button>
              <input
                ref={proofRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              onClick={recordPayment}
              disabled={recordingPay || !payAmount}
              className="w-full gradient-bg hover:opacity-90 gap-1.5"
            >
              {recordingPay ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {recordingPay ? "Recording…" : "Record Payment"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="space-y-1.5">
          <h5 className="text-xs font-medium text-muted-foreground">Payment History</h5>
          {payments.map((p) => (
            <div key={p.id} className="flex justify-between text-sm py-1.5 px-3 rounded bg-secondary/50">
              <span className="capitalize">{p.payment_method}</span>
              <span className="font-medium">{formatZarFromCents(p.amount_cents)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
