import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import PageHeader from "@/features/dashboard/components/page-header";
import { useFeatureGate } from "@/features/subscription/hooks/use-feature-gate";
import UpgradePrompt from "@/features/subscription/components/upgrade-prompt";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import CoverQuotePng from "@/assets/FieldFlow-request-a-quote.png";
import {
  Copy,
  Download,
  Inbox,
  Mail,
  MessageCircle,
  Plus,
  QrCode,
  RotateCcw,
  Share2,
  Code2,
} from "lucide-react";
import * as QRCode from "qrcode";
import { useNavigate } from "react-router-dom";
import { getFunctionsInvokeErrorMessage } from "@/lib/supabase-error";
import { QuoteRequestsTable, type QuoteRequest } from "@/features/quotes/components/quote-requests-table";
import { QuoteDetailDialog } from "@/features/quotes/components/quote-detail-dialog";
import { QuoteRequestsKpi } from "@/features/quotes/components/quote-requests-kpi";

type WidgetInstallation = {
  id: string;
  company_id: string;
  allowed_domains: string[];
  is_active: boolean;
  config: Record<string, unknown>;
  created_at: string;
};

/* ─── Utilities ─── */
function openSharePopup(url: string) {
  try { window.open(url, "_blank", "noopener,noreferrer"); } catch { window.location.href = url; }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

async function copyImagePng(dataUrl: string) {
  const navAny = navigator as any;
  if (!navAny?.clipboard?.write || typeof (window as any).ClipboardItem === "undefined")
    throw new Error("Clipboard image copy not supported.");
  const blob = await dataUrlToBlob(dataUrl);
  await navAny.clipboard.write([new (window as any).ClipboardItem({ [blob.type || "image/png"]: blob })]);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, Math.floor(Math.min(w, h) / 2)));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

async function buildQrPosterPngDataUrl({ coverUrl, qrDataUrl, title, subtitle }: { coverUrl: string; qrDataUrl: string; title: string; subtitle: string }): Promise<string> {
  const [cover, qr] = await Promise.all([loadImage(coverUrl), loadImage(qrDataUrl)]);
  const width = cover.naturalWidth || 1200;
  const height = cover.naturalHeight || 630;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(cover, 0, 0, width, height);
  const padding = Math.round(Math.min(width, height) * 0.06);
  const qrSize = Math.round(Math.min(width, height) * 0.32);
  const boxPad = Math.round(qrSize * 0.08);
  const boxX = width - padding - (qrSize + boxPad * 2);
  const boxY = height - padding - (qrSize + boxPad * 2);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = Math.round(qrSize * 0.08);
  ctx.shadowOffsetY = Math.round(qrSize * 0.03);
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  roundedRectPath(ctx, boxX, boxY, qrSize + boxPad * 2, qrSize + boxPad * 2, Math.round(qrSize * 0.12));
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundedRectPath(ctx, boxX + boxPad, boxY + boxPad, qrSize, qrSize, Math.round(qrSize * 0.06));
  ctx.clip();
  ctx.drawImage(qr, boxX + boxPad, boxY + boxPad, qrSize, qrSize);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = "rgba(15,23,42,0.92)";
  ctx.font = `800 ${Math.round(height * 0.045)}px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,Arial,sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(title, padding, height - padding);
  ctx.fillStyle = "rgba(15,23,42,0.78)";
  ctx.font = `600 ${Math.round(height * 0.028)}px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,Arial,sans-serif`;
  ctx.fillText(subtitle, padding, height - padding - Math.round(height * 0.055));
  ctx.restore();
  return canvas.toDataURL("image/png");
}

/* ─── Main Component ─── */
export default function QuoteRequests() {
  const { data: dashData, companyState } = useDashboardData();
  const companyId = dashData.company?.id;
  const publicKey = (dashData.company as any)?.public_key as string | undefined;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const gate = useFeatureGate(dashData.company?.subscription_tier as any);
  const canUseQuotes = gate.hasFeature("quote_requests");

  /* ── Data queries ── */
  const { data: quotes, isLoading: quotesLoading, isError: quotesError } = useQuery({
    queryKey: ["quote_requests", companyId],
    enabled: canUseQuotes && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_requests")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as QuoteRequest[];
    },
  });

  const { data: widgets, isLoading: widgetsLoading } = useQuery({
    queryKey: ["widget_installations", companyId],
    enabled: canUseQuotes && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("widget_installations")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WidgetInstallation[];
    },
  });

  /* ── Mutations ── */
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("quote_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quote_requests"] }),
  });

  const provisionRequester = useMutation({
    mutationFn: async (quoteRequestId: string) => {
      const { data, error } = await supabase.functions.invoke("provision-quote-requester", { body: { quoteRequestId } });
      if (error) { const details = await getFunctionsInvokeErrorMessage(error, { functionName: "provision-quote-requester" }); throw new Error(details); }
      return data as any;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["quote_requests"] });
      toast({ title: data?.emailSent ? "Login email sent" : "Customer linked", description: data?.emailSent ? "The customer can now log in to track this quote request." : "Linked to the customer portal (email was already sent)." });
    },
    onError: (e: any) => toast({ title: "Invite failed", description: e?.message ?? "Could not invite customer.", variant: "destructive" }),
  });

  const requestCallout = useMutation({
    mutationFn: async (quoteRequestId: string) => {
      const { data, error } = await supabase.functions.invoke("request-quote-callout", { body: { quoteRequestId } });
      if (error) { const details = await getFunctionsInvokeErrorMessage(error, { functionName: "request-quote-callout" }); throw new Error(details); }
      return data as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote_requests"] });
      toast({ title: "Call-out requested", description: "The customer has been notified." });
    },
    onError: (e: any) => toast({ title: "Request failed", description: e?.message ?? "Could not request call-out.", variant: "destructive" }),
  });

  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quote_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["quote_requests"] }); toast({ title: "Quote request deleted" }); },
  });

  /* ── Widget creation ── */
  const [newDomains, setNewDomains] = React.useState("");
  const [widgetDialogOpen, setWidgetDialogOpen] = React.useState(false);
  const createWidget = useMutation({
    mutationFn: async (domains: string[]) => {
      const { error } = await supabase.from("widget_installations").insert({ company_id: companyId!, allowed_domains: domains, is_active: true });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["widget_installations"] }); setWidgetDialogOpen(false); setNewDomains(""); toast({ title: "Widget installation created" }); },
  });

  /* ── Detail dialog ── */
  const [selectedQuote, setSelectedQuote] = React.useState<QuoteRequest | null>(null);

  /* ── QR / Share ── */
  const { data: quoteLinkToken, isLoading: quoteLinkLoading } = useQuery({
    queryKey: ["quote_link_token", companyId],
    enabled: canUseQuotes && !!companyId,
    queryFn: async () => { const { data, error } = await supabase.rpc("get_or_create_quote_link_token" as any); if (error) throw error; return data as string; },
  });

  const rotateQuoteLinkToken = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.rpc("rotate_quote_link_token" as any); if (error) throw error; return data as string; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["quote_link_token"] }); toast({ title: "QR link regenerated" }); },
  });

  const quoteLinkUrl = React.useMemo(() => {
    if (!quoteLinkToken) return "";
    try { return `${window.location.origin}/quote/${encodeURIComponent(quoteLinkToken)}`; } catch { return ""; }
  }, [quoteLinkToken]);

  const [qrDataUrl, setQrDataUrl] = React.useState("");
  const [posterDataUrl, setPosterDataUrl] = React.useState("");
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (!quoteLinkUrl) { setQrDataUrl(""); return; }
    let c = false;
    QRCode.toDataURL(quoteLinkUrl, { width: 256, margin: 1, errorCorrectionLevel: "M" }).then((u) => !c && setQrDataUrl(u)).catch(() => !c && setQrDataUrl(""));
    return () => { c = true; };
  }, [quoteLinkUrl]);

  React.useEffect(() => {
    if (!qrDataUrl) { setPosterDataUrl(""); return; }
    let c = false;
    buildQrPosterPngDataUrl({ coverUrl: CoverQuotePng, qrDataUrl, title: "Scan to request a quote", subtitle: "Powered by FieldFlow" }).then((u) => !c && setPosterDataUrl(u)).catch(() => !c && setPosterDataUrl(""));
    return () => { c = true; };
  }, [qrDataUrl]);

  const copyQuoteLink = React.useCallback(async () => {
    if (!quoteLinkUrl) return;
    try { await copyText(quoteLinkUrl); toast({ title: "Link copied" }); } catch { toast({ title: "Copy failed" }); }
  }, [quoteLinkUrl]);

  const downloadQr = React.useCallback(() => {
    if (!qrDataUrl) return;
    const a = document.createElement("a"); a.href = qrDataUrl; a.download = "fieldflow-quote-qr.png"; a.click();
  }, [qrDataUrl]);

  const downloadPoster = React.useCallback(() => {
    if (!posterDataUrl) return;
    const a = document.createElement("a"); a.href = posterDataUrl; a.download = "fieldflow-quote-qr-poster.png"; a.click();
  }, [posterDataUrl]);

  const copyQrImage = React.useCallback(async () => {
    if (!qrDataUrl) return;
    try { await copyImagePng(qrDataUrl); toast({ title: "QR image copied" }); } catch (e: any) { toast({ title: "Copy failed", description: e?.message }); }
  }, [qrDataUrl]);

  const copyPosterImage = React.useCallback(async () => {
    if (!posterDataUrl) return;
    try { await copyImagePng(posterDataUrl); toast({ title: "Poster image copied" }); } catch (e: any) { toast({ title: "Copy failed", description: e?.message }); }
  }, [posterDataUrl]);

  const shareText = React.useMemo(() => quoteLinkUrl ? `Request a quote: ${quoteLinkUrl}` : "", [quoteLinkUrl]);
  const whatsappUrl = React.useMemo(() => quoteLinkUrl ? `https://wa.me/?text=${encodeURIComponent(shareText)}` : "", [quoteLinkUrl, shareText]);
  const telegramUrl = React.useMemo(() => quoteLinkUrl ? `https://t.me/share/url?url=${encodeURIComponent(quoteLinkUrl)}&text=${encodeURIComponent("Request a quote")}` : "", [quoteLinkUrl]);
  const emailUrl = React.useMemo(() => quoteLinkUrl ? `mailto:?subject=${encodeURIComponent("Request a quote")}&body=${encodeURIComponent(shareText)}` : "", [quoteLinkUrl, shareText]);

  const nativeShare = React.useCallback(async () => {
    if (!quoteLinkUrl) return;
    const navAny = navigator as any;
    if (!navAny?.share) { setShareDialogOpen(true); return; }
    try {
      if (posterDataUrl) {
        const blob = await dataUrlToBlob(posterDataUrl);
        const file = new File([blob], "fieldflow-quote-request.png", { type: blob.type || "image/png" });
        if (navAny.canShare?.({ files: [file] })) { await navAny.share({ title: "Request a quote", text: "Scan the QR code or open the link.", files: [file] }); return; }
      }
      await navAny.share({ title: "Request a quote", text: "Open this link to request a quote.", url: quoteLinkUrl });
    } catch { /* user cancelled */ }
  }, [posterDataUrl, quoteLinkUrl]);

  const embedSnippet = publicKey
    ? `<div id="fieldflow-quote"></div>\n<script\n  src="${window.location.origin}/widgets/quote.js"\n  data-company="${publicKey}"\n  data-mount="#fieldflow-quote">\n</script>`
    : "";

  /* ── Status change handler (intercepts quoted / callout-requested) ── */
  const handleStatusChange = React.useCallback((id: string, status: string) => {
    if (status === "quoted") provisionRequester.mutate(id);
    else if (status === "callout-requested") requestCallout.mutate(id);
    else updateStatus.mutate({ id, status });
  }, [provisionRequester, requestCallout, updateStatus]);

  /* ── Loading / upgrade guards ── */
  if (companyState.kind === "loading" && !dashData.company) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (dashData.company && !canUseQuotes) {
    return <UpgradePrompt feature="Quote requests" requiredTier="business" currentTier={gate.tier as any} />;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Quote Requests" subtitle="Manage incoming quote requests and share your booking link." />

      {/* KPI row */}
      <QuoteRequestsKpi quotes={quotes} isLoading={quotesLoading} />

      {/* Main content area with tabs for setup vs requests */}
      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList className="bg-muted/30 h-9 p-0.5">
          <TabsTrigger value="requests" className="text-sm h-8 px-4 data-[state=active]:shadow-sm">
            <Inbox className="h-3.5 w-3.5 mr-2" /> Requests
          </TabsTrigger>
          <TabsTrigger value="setup" className="text-sm h-8 px-4 data-[state=active]:shadow-sm">
            <QrCode className="h-3.5 w-3.5 mr-2" /> QR & Widget
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-0">
          <QuoteRequestsTable
            quotes={quotes}
            isLoading={quotesLoading}
            isError={quotesError}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ["quote_requests"] })}
            onView={setSelectedQuote}
            onDelete={(id) => deleteQuote.mutate(id)}
            onStatusChange={handleStatusChange}
          />
        </TabsContent>

        <TabsContent value="setup" className="mt-0 space-y-4">
          {/* QR Code Card */}
          <Card className="shadow-sm border-border/40 rounded-xl">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg p-1.5 bg-primary/10">
                  <QrCode className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">QR Quote Form</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Print or share a QR code that opens a branded quote request form.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {quoteLinkLoading ? (
                <div className="grid gap-4 md:grid-cols-[240px_1fr]">
                  <Skeleton className="h-[240px] w-[240px] rounded-xl" />
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full rounded-lg" />
                    <Skeleton className="h-8 w-2/3" />
                    <Skeleton className="h-8 w-1/2" />
                  </div>
                </div>
              ) : quoteLinkUrl ? (
                <div className="grid gap-4 md:grid-cols-[240px_1fr] items-start">
                  <div className="rounded-xl border border-border/40 bg-background p-3 shadow-sm">
                    <div className="rounded-lg bg-[hsl(0_0%_100%)] p-2">
                      {qrDataUrl ? (
                        <img src={qrDataUrl} alt="Quote request QR code" className="h-[208px] w-[208px]" />
                      ) : (
                        <div className="flex h-[208px] w-[208px] items-center justify-center text-xs text-muted-foreground">Generating…</div>
                      )}
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground text-center">
                      Scans open the quote request form
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5">
                      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Share link</div>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded break-all flex-1">{quoteLinkUrl}</code>
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={copyQuoteLink}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" disabled={!quoteLinkUrl}>
                            <Share2 className="h-3.5 w-3.5 mr-2" /> Share
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Share quote request</DialogTitle>
                            <DialogDescription>Share a link or image that customers can scan to request a quote.</DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <div className="text-xs font-semibold">QR code</div>
                              <div className="rounded-xl border border-border/40 bg-[hsl(0_0%_100%)] p-3">
                                {qrDataUrl ? <img src={qrDataUrl} alt="QR" className="mx-auto h-[200px] w-[200px]" /> : <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">Generating…</div>}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={copyQrImage} disabled={!qrDataUrl}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy</Button>
                                <Button variant="outline" size="sm" onClick={downloadQr} disabled={!qrDataUrl}><Download className="h-3.5 w-3.5 mr-1.5" /> Download</Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="text-xs font-semibold">Poster (recommended)</div>
                              <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                                {posterDataUrl ? <img src={posterDataUrl} alt="Poster" className="w-full rounded-lg border border-border/30" /> : <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">Building poster…</div>}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={copyPosterImage} disabled={!posterDataUrl}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy</Button>
                                <Button variant="outline" size="sm" onClick={downloadPoster} disabled={!posterDataUrl}><Download className="h-3.5 w-3.5 mr-1.5" /> Download</Button>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <Button asChild variant="outline" size="sm"><a href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5 mr-1.5" /> WhatsApp</a></Button>
                            <Button asChild variant="outline" size="sm"><a href={telegramUrl} target="_blank" rel="noreferrer">Telegram</a></Button>
                            <Button asChild variant="outline" size="sm"><a href={emailUrl}><Mail className="h-3.5 w-3.5 mr-1.5" /> Email</a></Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button variant="outline" size="sm" onClick={nativeShare} disabled={!quoteLinkUrl}>
                        <Share2 className="h-3.5 w-3.5 mr-2" /> Native share
                      </Button>
                      <Button variant="outline" size="sm" onClick={downloadQr} disabled={!qrDataUrl}>
                        <Download className="h-3.5 w-3.5 mr-2" /> Download QR
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => rotateQuoteLinkToken.mutate()} disabled={rotateQuoteLinkToken.isPending}>
                        <RotateCcw className="h-3.5 w-3.5 mr-2" /> {rotateQuoteLinkToken.isPending ? "Regenerating…" : "Regenerate"}
                      </Button>
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      Use on business cards, vehicles, job cards, or invoices. Regenerating invalidates old QR codes.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Unable to generate a QR link.</p>
              )}
            </CardContent>
          </Card>

          {/* Embed Widget Card */}
          <Card className="shadow-sm border-border/40 rounded-xl">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg p-1.5 bg-primary/10">
                  <Code2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Embeddable Widget</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Add this snippet to any website to receive quote requests.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {publicKey ? (
                <>
                  <div className="relative">
                    <pre className="bg-muted/50 border border-border/40 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">
                      {embedSnippet}
                    </pre>
                    <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-7 w-7" onClick={() => { navigator.clipboard.writeText(embedSnippet); toast({ title: "Copied" }); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Public key: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{publicKey}</code>
                  </p>
                </>
              ) : (
                <Skeleton className="h-24 w-full rounded-lg" />
              )}

              {/* Allowed domains */}
              <div className="flex items-center justify-between pt-1">
                <h4 className="text-xs font-semibold">Allowed Domains</h4>
                <Dialog open={widgetDialogOpen} onOpenChange={setWidgetDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Domain
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Widget Domain</DialogTitle>
                      <DialogDescription>Enter domains allowed to use the widget (comma-separated).</DialogDescription>
                    </DialogHeader>
                    <Input placeholder="example.com, app.example.com" value={newDomains} onChange={(e) => setNewDomains(e.target.value)} />
                    <DialogFooter>
                      <Button onClick={() => createWidget.mutate(newDomains.split(",").map((d) => d.trim()).filter(Boolean))} disabled={createWidget.isPending}>
                        {createWidget.isPending ? "Creating…" : "Create"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {widgetsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-2/3" />
                </div>
              ) : widgets && widgets.length > 0 ? (
                <div className="space-y-1.5">
                  {widgets.map((w) => (
                    <div key={w.id} className="flex items-center gap-2 text-xs py-1">
                      <Badge variant={w.is_active ? "default" : "secondary"} className="text-[10px]">
                        {w.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <span className="text-muted-foreground">
                        {w.allowed_domains.length > 0 ? w.allowed_domains.join(", ") : "All domains"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No installations yet. Quotes from any domain will be accepted.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      <QuoteDetailDialog
        quote={selectedQuote}
        onClose={() => setSelectedQuote(null)}
        onNavigateToJobs={() => navigate("/dashboard/jobs")}
        onRequestCallout={(id) => requestCallout.mutate(id)}
        onSendPortalLogin={(id) => provisionRequester.mutate(id)}
        isRequestingCallout={requestCallout.isPending}
        isSendingPortalLogin={provisionRequester.isPending}
      />
    </div>
  );
}
