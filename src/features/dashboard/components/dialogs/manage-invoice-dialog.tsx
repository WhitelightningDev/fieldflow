import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatZarFromCents } from "@/lib/money";
import { Camera, CheckCircle2, ExternalLink, Loader2, MessageCircle, Save, Send } from "lucide-react";
import * as React from "react";

type Invoice = Tables<"invoices">;
type InvoicePayment = Tables<"invoice_payments">;

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "eft", label: "EFT / Bank Transfer" },
  { value: "mobile", label: "Mobile Payment" },
  { value: "other", label: "Other" },
] as const;

function centsFromZarInput(v: string) {
  const n = Number.parseFloat(String(v ?? "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

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

export default function ManageInvoiceDialog({ invoiceId, trigger }: { invoiceId: string; trigger?: React.ReactNode }) {
  const { data, actions } = useDashboardData();
  const [open, setOpen] = React.useState(false);

  const invoice = React.useMemo(() => data.invoices.find((i) => i.id === invoiceId) as Invoice | undefined, [data.invoices, invoiceId]);
  const job = React.useMemo(() => data.jobCards.find((j) => j.id === invoice?.job_card_id) as any, [data.jobCards, invoice?.job_card_id]);
  const customer = React.useMemo(() => data.customers.find((c) => c.id === invoice?.customer_id) as any, [data.customers, invoice?.customer_id]);
  const site = React.useMemo(() => data.sites.find((s) => s.id === job?.site_id) as any, [data.sites, job?.site_id]);
  const payments = React.useMemo(() => {
    const rows = data.invoicePayments.filter((p) => p.invoice_id === invoiceId) as InvoicePayment[];
    rows.sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
    return rows;
  }, [data.invoicePayments, invoiceId]);

  const [notes, setNotes] = React.useState("");
  const [savingNotes, setSavingNotes] = React.useState(false);

  const [sending, setSending] = React.useState(false);

  // Payment state
  const [payMethod, setPayMethod] = React.useState<(typeof PAYMENT_METHODS)[number]["value"]>("cash");
  const [payAmount, setPayAmount] = React.useState("");
  const [payRef, setPayRef] = React.useState("");
  const [proofFile, setProofFile] = React.useState<File | null>(null);
  const [recordingPay, setRecordingPay] = React.useState(false);
  const proofRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open || !invoice) return;
    setNotes(invoice.notes ?? "");
    setPayMethod("cash");
    setPayAmount("");
    setPayRef("");
    setProofFile(null);
  }, [invoice, open]);

  if (!invoice) return null;

  const totalPaid = invoice.amount_paid_cents ?? 0;
  const balance = Math.max(0, (invoice.total_cents ?? 0) - totalPaid);
  const lineItems = parseLineItems(invoice.line_items);

  const markSent = async () => {
    setSending(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("invoices")
      .update({ sent_at: now, status: "sent" })
      .eq("id", invoice.id);
    setSending(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Invoice marked as sent" });
    await actions.refreshData({ silent: true });
  };

  const shareWhatsApp = async () => {
    const phone = String(customer?.phone ?? "").replace(/\D/g, "");
    if (!phone) {
      toast({ title: "No customer phone", description: "Add a phone number to share via WhatsApp.", variant: "destructive" });
      return;
    }
    const msg = encodeURIComponent(
      `Hi ${customer?.name ?? ""},\n\nPlease find your invoice ${invoice.invoice_number} for ${formatZarFromCents(invoice.total_cents)}.\n\nThank you!`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
    await markSent();
  };

  const saveInvoiceNotes = async () => {
    setSavingNotes(true);
    const { error } = await supabase.from("invoices").update({ notes }).eq("id", invoice.id);
    setSavingNotes(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Notes saved" });
    await actions.refreshData({ silent: true });
  };

  const openPaymentProof = async (payment: InvoicePayment) => {
    const path = payment.proof_storage_path;
    if (!path) return;
    const { data: signed, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 60);
    if (error || !signed?.signedUrl) {
      toast({ title: "Could not open proof", description: error?.message ?? "Signed URL unavailable.", variant: "destructive" });
      return;
    }
    window.open(signed.signedUrl, "_blank", "noreferrer");
  };

  const recordPayment = async () => {
    const amountCents = centsFromZarInput(payAmount);
    if (!amountCents) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }

    setRecordingPay(true);
    let proofPath: string | null = null;

    try {
      if (proofFile) {
        const ext = proofFile.name.split(".").pop() ?? "jpg";
        proofPath = `${invoice.id}/proof-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("payment-proofs")
          .upload(proofPath, proofFile);
        if (uploadErr) throw uploadErr;
      }

      const { error } = await supabase.from("invoice_payments").insert({
        company_id: invoice.company_id,
        invoice_id: invoice.id,
        amount_cents: amountCents,
        paid_at: new Date().toISOString(),
        payment_method: payMethod,
        reference: payRef || null,
        proof_storage_path: proofPath,
      } as any);
      if (error) throw error;

      const newPaid = (invoice.amount_paid_cents ?? 0) + amountCents;
      const newStatus = newPaid >= invoice.total_cents ? "paid" : "partial";
      const { error: invErr } = await supabase
        .from("invoices")
        .update({ amount_paid_cents: newPaid, status: newStatus })
        .eq("id", invoice.id);
      if (invErr) throw invErr;

      // Best-effort: treat job "revenue" as realised income (paid amount).
      await supabase.from("job_cards").update({ revenue_cents: newPaid } as any).eq("id", invoice.job_card_id);

      toast({ title: "Payment recorded" });
      setPayAmount("");
      setPayRef("");
      setProofFile(null);
      if (proofRef.current) proofRef.current.value = "";
      await actions.refreshData({ silent: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Payment failed";
      toast({ title: "Error recording payment", description: msg, variant: "destructive" });
    } finally {
      setRecordingPay(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            View
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 truncate">{invoice.invoice_number}</span>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={invoice.status === "paid" ? "default" : invoice.status === "partial" ? "secondary" : "outline"}>
                {invoice.status}
              </Badge>
              <Badge variant="outline">{formatZarFromCents(invoice.total_cents)}</Badge>
            </div>
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <div className="text-xs text-muted-foreground">
              {customer?.name ? `Customer: ${customer.name}` : "No customer linked"}
              {job?.title ? ` • Job: ${job.title}` : ""}
              {site?.name ? ` • Site: ${site.name}` : ""}
            </div>
            <div className="text-xs text-muted-foreground">
              Created {new Date(invoice.created_at).toLocaleString()}
              {invoice.sent_at ? ` • Sent ${new Date(invoice.sent_at).toLocaleString()}` : ""}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Invoice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
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
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatZarFromCents(invoice.total_cents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="text-emerald-600 dark:text-emerald-400">{formatZarFromCents(totalPaid)}</span>
              </div>
              {balance > 0 ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance</span>
                  <span className="text-destructive font-medium">{formatZarFromCents(balance)}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="bg-card/70 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={sending} onClick={() => void markSent()}>
                    <Send className="h-4 w-4" />
                    {sending ? "Saving…" : invoice.sent_at ? "Re-send (mark sent)" : "Mark sent"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void shareWhatsApp()}>
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Email delivery is not automated yet; “Mark sent” tracks dispatch in the system.
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/70 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes for this invoice…" />
                <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={savingNotes} onClick={() => void saveInvoiceNotes()}>
                  {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {savingNotes ? "Saving…" : "Save notes"}
                </Button>
              </CardContent>
            </Card>

            {balance > 0 ? (
              <Card className="bg-card/70 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Record payment</CardTitle>
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
                      <Select value={payMethod} onValueChange={(v) => setPayMethod(v as any)}>
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

                  <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Reference (optional)" className="h-9" />

                  <div>
                    <Button size="sm" variant="outline" onClick={() => proofRef.current?.click()} className="gap-1.5 w-full">
                      <Camera className="h-4 w-4" />
                      {proofFile ? proofFile.name : "Upload proof (optional)"}
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
                    type="button"
                    className="w-full gradient-bg hover:opacity-90 shadow-glow gap-1.5"
                    onClick={() => void recordPayment()}
                    disabled={recordingPay}
                  >
                    {recordingPay ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {recordingPay ? "Recording…" : "Record payment"}
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>

        {payments.length > 0 ? (
          <Card className="bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Payment history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-secondary/40 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm">
                      <span className="capitalize">{p.payment_method}</span>{" "}
                      <span className="text-muted-foreground">•</span>{" "}
                      <span className="font-medium">{formatZarFromCents(p.amount_cents ?? 0)}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(p.paid_at).toLocaleString()}
                      {p.reference ? ` • Ref: ${p.reference}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.proof_storage_path ? (
                      <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void openPaymentProof(p)}>
                        <ExternalLink className="h-4 w-4" />
                        Proof
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
