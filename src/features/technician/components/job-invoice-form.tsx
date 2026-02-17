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
  technicianRate: number; // cents per hour
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
  technicianRate,
  onInvoiceCreated,
}: Props) {
  const [invoice, setInvoice] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [notes, setNotes] = React.useState("");

  // Payment state
  const [payMethod, setPayMethod] = React.useState("cash");
  const [payAmount, setPayAmount] = React.useState("");
  const [payRef, setPayRef] = React.useState("");
  const [proofFile, setProofFile] = React.useState<File | null>(null);
  const [recordingPay, setRecordingPay] = React.useState(false);
  const [payments, setPayments] = React.useState<any[]>([]);
  const [sending, setSending] = React.useState(false);
  const proofRef = React.useRef<HTMLInputElement>(null);

  // Calculate totals
  const totalMinutes = timeEntries.filter((e) => e.minutes != null).reduce((s, e) => s + e.minutes, 0);
  const labourCents = Math.round((totalMinutes / 60) * technicianRate);
  const partsCents = usedParts.reduce((s, p) => {
    const unitCost = p.inventory_items?.unit_cost_cents ?? 0;
    return s + unitCost * (p.quantity_used ?? 1);
  }, 0);
  const subtotal = labourCents + partsCents;
  const vatPct = 15;
  const vatCents = Math.round(subtotal * (vatPct / 100));
  const totalCents = subtotal + vatCents;

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
      {
        description: `Labour: ${totalMinutes} min @ ${formatZarFromCents(technicianRate)}/hr`,
        amount_cents: labourCents,
      },
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
      labour_rate_cents: technicianRate,
      labour_total_cents: labourCents,
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
          <div className="flex justify-between">
            <span className="text-muted-foreground">Labour ({totalMinutes} min)</span>
            <span className="font-medium">{formatZarFromCents(labourCents)}</span>
          </div>
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
