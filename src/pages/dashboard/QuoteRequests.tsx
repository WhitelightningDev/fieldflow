import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import PageHeader from "@/features/dashboard/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import CoverQuotePng from "@/assets/FieldFlow-request-a-quote.png";
import {
  Copy,
  Download,
  Eye,
  Inbox,
  Mail,
  MessageCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Share2,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import * as QRCode from "qrcode";

type QuoteRequest = {
  id: string;
  company_id: string;
  widget_installation_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  trade: string | null;
  address: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

type WidgetInstallation = {
  id: string;
  company_id: string;
  allowed_domains: string[];
  is_active: boolean;
  config: Record<string, unknown>;
  created_at: string;
};

const STATUS_OPTIONS = [
  { value: "new", label: "New", variant: "default" as const },
  { value: "contacted", label: "Contacted", variant: "secondary" as const },
  { value: "quoted", label: "Quoted", variant: "outline" as const },
  { value: "won", label: "Won", variant: "default" as const },
  { value: "lost", label: "Lost", variant: "destructive" as const },
];

function statusBadge(status: string) {
  const opt = STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0];
  return <Badge variant={opt.variant}>{opt.label}</Badge>;
}

function openSharePopup(url: string) {
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    window.location.href = url;
  }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

async function copyImagePng(dataUrl: string) {
  const navAny = navigator as any;
  const canWrite = !!navAny?.clipboard?.write && typeof (window as any).ClipboardItem !== "undefined";
  if (!canWrite) throw new Error("Clipboard image copy not supported in this browser.");

  const blob = await dataUrlToBlob(dataUrl);
  await navAny.clipboard.write([
    new (window as any).ClipboardItem({
      [blob.type || "image/png"]: blob,
    }),
  ]);
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

async function buildQrPosterPngDataUrl({
  coverUrl,
  qrDataUrl,
  title,
  subtitle,
}: {
  coverUrl: string;
  qrDataUrl: string;
  title: string;
  subtitle: string;
}): Promise<string> {
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

export default function QuoteRequests() {
  const { data: dashData } = useDashboardData();
  const companyId = dashData.company?.id;
  const publicKey = (dashData.company as any)?.public_key as string | undefined;
  const queryClient = useQueryClient();

  // Fetch quote requests
  const { data: quotes, isLoading: quotesLoading } = useQuery({
    queryKey: ["quote_requests", companyId],
    enabled: !!companyId,
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

  // Fetch widget installations
  const { data: widgets, isLoading: widgetsLoading } = useQuery({
    queryKey: ["widget_installations", companyId],
    enabled: !!companyId,
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

  // Update quote status
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("quote_requests")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote_requests"] });
    },
  });

  // Delete quote
  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("quote_requests")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote_requests"] });
      toast({ title: "Quote request deleted" });
    },
  });

  // Create widget installation
  const [newDomains, setNewDomains] = React.useState("");
  const [widgetDialogOpen, setWidgetDialogOpen] = React.useState(false);

  const createWidget = useMutation({
    mutationFn: async (domains: string[]) => {
      const { error } = await supabase
        .from("widget_installations")
        .insert({
          company_id: companyId!,
          allowed_domains: domains,
          is_active: true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["widget_installations"] });
      setWidgetDialogOpen(false);
      setNewDomains("");
      toast({ title: "Widget installation created" });
    },
  });

  // Detail dialog
  const [selectedQuote, setSelectedQuote] = React.useState<QuoteRequest | null>(null);

  // QR / shareable quote link (token is opaque and can be printed/shared publicly)
  const { data: quoteLinkToken, isLoading: quoteLinkLoading } = useQuery({
    queryKey: ["quote_link_token", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_or_create_quote_link_token" as any);
      if (error) throw error;
      return data as string;
    },
  });

  const rotateQuoteLinkToken = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rotate_quote_link_token" as any);
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote_link_token"] });
      toast({ title: "QR link regenerated", description: "Old QR codes will stop working." });
    },
  });

  const quoteLinkUrl = React.useMemo(() => {
    if (!quoteLinkToken) return "";
    try {
      return `${window.location.origin}/quote-request.html?t=${encodeURIComponent(quoteLinkToken)}`;
    } catch {
      return "";
    }
  }, [quoteLinkToken]);

  const quoteAppUrl = React.useMemo(() => {
    if (!quoteLinkToken) return "";
    try {
      return `${window.location.origin}/quote/${encodeURIComponent(quoteLinkToken)}`;
    } catch {
      return "";
    }
  }, [quoteLinkToken]);

  const [qrDataUrl, setQrDataUrl] = React.useState<string>("");
  const [posterDataUrl, setPosterDataUrl] = React.useState<string>("");
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (!quoteLinkUrl) {
      setQrDataUrl("");
      return;
    }

    let cancelled = false;
    void QRCode.toDataURL(quoteLinkUrl, { width: 256, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [quoteLinkUrl]);

  React.useEffect(() => {
    if (!qrDataUrl) {
      setPosterDataUrl("");
      return;
    }

    let cancelled = false;
    void buildQrPosterPngDataUrl({
      coverUrl: CoverQuotePng,
      qrDataUrl,
      title: "Scan to request a quote",
      subtitle: "Powered by FieldFlow",
    })
      .then((url) => {
        if (!cancelled) setPosterDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPosterDataUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [qrDataUrl]);

  const copyQuoteLink = React.useCallback(async () => {
    if (!quoteLinkUrl) return;
    try {
      await copyText(quoteLinkUrl);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Copy failed", description: "Your browser blocked clipboard access." });
    }
  }, [quoteLinkUrl]);

  const downloadQr = React.useCallback(() => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = "fieldflow-quote-qr.png";
    a.click();
  }, [qrDataUrl]);

  const downloadPoster = React.useCallback(() => {
    if (!posterDataUrl) return;
    const a = document.createElement("a");
    a.href = posterDataUrl;
    a.download = "fieldflow-quote-qr-poster.png";
    a.click();
  }, [posterDataUrl]);

  const copyQrImage = React.useCallback(async () => {
    if (!qrDataUrl) return;
    try {
      await copyImagePng(qrDataUrl);
      toast({ title: "QR image copied" });
    } catch (err: any) {
      toast({ title: "Copy failed", description: err?.message || "Clipboard image copy not supported." });
    }
  }, [qrDataUrl]);

  const copyPosterImage = React.useCallback(async () => {
    if (!posterDataUrl) return;
    try {
      await copyImagePng(posterDataUrl);
      toast({ title: "Poster image copied" });
    } catch (err: any) {
      toast({ title: "Copy failed", description: err?.message || "Clipboard image copy not supported." });
    }
  }, [posterDataUrl]);

  const nativeShare = React.useCallback(async () => {
    if (!quoteLinkUrl) return;

    const navAny = navigator as any;
    const share = navAny?.share as ((data: any) => Promise<void>) | undefined;
    const canShare = navAny?.canShare as ((data: any) => boolean) | undefined;

    if (!share) {
      setShareDialogOpen(true);
      return;
    }

    try {
      if (posterDataUrl) {
        const blob = await dataUrlToBlob(posterDataUrl);
        const file = new File([blob], "fieldflow-quote-request.png", { type: blob.type || "image/png" });
        if (canShare?.({ files: [file] })) {
          await share({
            title: "Request a quote",
            text: "Scan the QR code or open the link to request a quote.",
            files: [file],
          });
          return;
        }
      }

      await share({ title: "Request a quote", text: "Open this link to request a quote.", url: quoteLinkUrl });
    } catch {
      // user cancelled or share failed
    }
  }, [posterDataUrl, quoteLinkUrl]);

  const shareText = React.useMemo(() => {
    if (!quoteLinkUrl) return "";
    return `Request a quote: ${quoteLinkUrl}`;
  }, [quoteLinkUrl]);

  const whatsappUrl = React.useMemo(() => {
    if (!quoteLinkUrl) return "";
    return `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  }, [quoteLinkUrl, shareText]);

  const telegramUrl = React.useMemo(() => {
    if (!quoteLinkUrl) return "";
    return `https://t.me/share/url?url=${encodeURIComponent(quoteLinkUrl)}&text=${encodeURIComponent("Request a quote")}`;
  }, [quoteLinkUrl]);

  const emailUrl = React.useMemo(() => {
    if (!quoteLinkUrl) return "";
    return `mailto:?subject=${encodeURIComponent("Request a quote")}&body=${encodeURIComponent(shareText)}`;
  }, [quoteLinkUrl, shareText]);

  const smsUrl = React.useMemo(() => {
    if (!quoteLinkUrl) return "";
    return `sms:?body=${encodeURIComponent(shareText)}`;
  }, [quoteLinkUrl, shareText]);

  const xUrl = React.useMemo(() => {
    if (!quoteLinkUrl) return "";
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent("Request a quote")}&url=${encodeURIComponent(quoteLinkUrl)}`;
  }, [quoteLinkUrl]);

  const linkedinUrl = React.useMemo(() => {
    if (!quoteLinkUrl) return "";
    return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(quoteLinkUrl)}`;
  }, [quoteLinkUrl]);

  const facebookUrl = React.useMemo(() => {
    if (!quoteLinkUrl) return "";
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(quoteLinkUrl)}`;
  }, [quoteLinkUrl]);

  const embedSnippet = publicKey
    ? `<div id="fieldflow-quote"></div>
<script
  src="${window.location.origin}/widgets/quote.js"
  data-company="${publicKey}"
  data-mount="#fieldflow-quote">
</script>`
    : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quote Requests"
        subtitle="Manage incoming quote requests from your website widget"
      />

      {/* Widget Setup Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Embeddable Widget</CardTitle>
          <CardDescription>
            Add this snippet to any website to receive quote requests directly in your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {publicKey ? (
            <>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap break-all">
                  {embedSnippet}
                </pre>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    navigator.clipboard.writeText(embedSnippet);
                    toast({ title: "Copied to clipboard" });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your public key: <code className="bg-muted px-1 py-0.5 rounded">{publicKey}</code>
              </p>
            </>
          ) : (
            <Skeleton className="h-24 w-full" />
          )}

          {/* Widget Installations */}
          <div className="flex items-center justify-between pt-2">
            <h4 className="text-sm font-medium">Allowed Domains</h4>
            <Dialog open={widgetDialogOpen} onOpenChange={setWidgetDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" /> Add Domain
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Widget Domain</DialogTitle>
                  <DialogDescription>
                    Enter the domains allowed to use the quote widget (comma-separated).
                    Leave empty to allow all domains.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  placeholder="example.com, app.example.com"
                  value={newDomains}
                  onChange={(e) => setNewDomains(e.target.value)}
                />
                <DialogFooter>
                  <Button
                    onClick={() => {
                      const domains = newDomains
                        .split(",")
                        .map((d) => d.trim())
                        .filter(Boolean);
                      createWidget.mutate(domains);
                    }}
                    disabled={createWidget.isPending}
                  >
                    {createWidget.isPending ? "Creating…" : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {widgetsLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : widgets && widgets.length > 0 ? (
            <div className="space-y-2">
              {widgets.map((w) => (
                <div key={w.id} className="flex items-center gap-2 text-sm">
                  <Badge variant={w.is_active ? "default" : "secondary"}>
                    {w.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <span className="text-muted-foreground">
                    {w.allowed_domains.length > 0
                      ? w.allowed_domains.join(", ")
                      : "All domains"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No widget installations yet. Quotes from any domain will be accepted.
            </p>
          )}
        </CardContent>
      </Card>

      {/* QR Code / Shareable Link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">QR Quote Form</CardTitle>
          <CardDescription>
            Print or share a QR code that opens a branded quote request form.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {quoteLinkLoading ? (
            <div className="grid gap-4 md:grid-cols-[280px_1fr]">
              <Skeleton className="h-[280px] w-[280px] rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-8 w-1/2" />
              </div>
            </div>
          ) : quoteLinkUrl ? (
            <div className="grid gap-4 md:grid-cols-[280px_1fr] items-start">
              <div className="rounded-xl border border-border/60 bg-background p-4 shadow-sm">
                <div className="rounded-lg bg-white p-3">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="Quote request QR code" className="h-[232px] w-[232px]" />
                  ) : (
                    <div className="flex h-[232px] w-[232px] items-center justify-center text-sm text-muted-foreground">
                      Generating…
                    </div>
                  )}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Scans open:{" "}
                  <a className="text-primary underline" href={quoteLinkUrl} target="_blank" rel="noreferrer">
                    Quote request form
                  </a>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                  <div className="text-xs text-muted-foreground mb-1">Share link</div>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded break-all">{quoteLinkUrl}</code>
                    <Button size="icon" variant="ghost" onClick={copyQuoteLink} title="Copy link">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" disabled={!quoteLinkUrl}>
                        <Share2 className="h-4 w-4 mr-2" /> Share
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Share quote request</DialogTitle>
                        <DialogDescription>
                          Share a link or image that customers can scan to request a quote.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="text-sm font-medium">QR code</div>
                          <div className="rounded-xl border border-border/60 bg-white p-3">
                            {qrDataUrl ? (
                              <img src={qrDataUrl} alt="Quote request QR code" className="mx-auto h-[220px] w-[220px]" />
                            ) : (
                              <div className="flex h-[220px] w-[220px] items-center justify-center text-sm text-muted-foreground">
                                Generating…
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={copyQrImage} disabled={!qrDataUrl}>
                              <Copy className="h-4 w-4 mr-2" /> Copy QR image
                            </Button>
                            <Button variant="outline" onClick={downloadQr} disabled={!qrDataUrl}>
                              <Download className="h-4 w-4 mr-2" /> Download QR
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-medium">Share poster (recommended)</div>
                          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                            {posterDataUrl ? (
                              <img
                                src={posterDataUrl}
                                alt="Quote request poster"
                                className="w-full rounded-lg border border-border/50 bg-background"
                              />
                            ) : (
                              <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                                Building poster…
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={copyPosterImage} disabled={!posterDataUrl}>
                              <Copy className="h-4 w-4 mr-2" /> Copy poster
                            </Button>
                            <Button variant="outline" onClick={downloadPoster} disabled={!posterDataUrl}>
                              <Download className="h-4 w-4 mr-2" /> Download poster
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                        <div className="text-xs text-muted-foreground mb-1">Share link (best for previews)</div>
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded break-all">{quoteLinkUrl}</code>
                          <Button size="icon" variant="ghost" onClick={copyQuoteLink} title="Copy link">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          This link uses the FieldFlow cover image when shared.
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button onClick={nativeShare} disabled={!quoteLinkUrl}>
                          <Share2 className="h-4 w-4 mr-2" /> Native share
                        </Button>
                        <Button variant="outline" onClick={copyQuoteLink} disabled={!quoteLinkUrl}>
                          <Copy className="h-4 w-4 mr-2" /> Copy link
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => quoteAppUrl && openSharePopup(quoteAppUrl)}
                          disabled={!quoteAppUrl}
                          title="Open the actual form route"
                        >
                          Open form
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <Button asChild variant="outline" disabled={!whatsappUrl}>
                          <a href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="Share via WhatsApp">
                            <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
                          </a>
                        </Button>
                        <Button asChild variant="outline" disabled={!telegramUrl}>
                          <a href={telegramUrl} target="_blank" rel="noreferrer" aria-label="Share via Telegram">
                            Telegram
                          </a>
                        </Button>
                        <Button asChild variant="outline" disabled={!emailUrl}>
                          <a href={emailUrl} aria-label="Share via email">
                            <Mail className="h-4 w-4 mr-2" /> Email
                          </a>
                        </Button>
                        <Button asChild variant="outline" disabled={!smsUrl}>
                          <a href={smsUrl} aria-label="Share via SMS">
                            SMS
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!xUrl}
                          onClick={() => xUrl && openSharePopup(xUrl)}
                          aria-label="Share on X"
                        >
                          X
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!linkedinUrl}
                          onClick={() => linkedinUrl && openSharePopup(linkedinUrl)}
                          aria-label="Share on LinkedIn"
                        >
                          LinkedIn
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!facebookUrl}
                          onClick={() => facebookUrl && openSharePopup(facebookUrl)}
                          aria-label="Share on Facebook"
                        >
                          Facebook
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button variant="outline" onClick={downloadQr} disabled={!qrDataUrl}>
                    <Download className="h-4 w-4 mr-2" /> Download QR
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => rotateQuoteLinkToken.mutate()}
                    disabled={rotateQuoteLinkToken.isPending}
                    title="Regenerate the token (old QR codes stop working)"
                  >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {rotateQuoteLinkToken.isPending ? "Regenerating…" : "Regenerate"}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Tip: use this on business cards, vehicles, job cards, or invoices. Regenerating will invalidate previously shared QR codes.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Unable to generate a QR link for this company.</p>
          )}
        </CardContent>
      </Card>

      {/* Quote Requests Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Incoming Requests</CardTitle>
            <CardDescription>
              {quotes?.length ?? 0} total request{(quotes?.length ?? 0) !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["quote_requests"] })}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {quotesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : quotes && quotes.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{q.name}</TableCell>
                      <TableCell>{q.email}</TableCell>
                      <TableCell>{q.trade ?? "—"}</TableCell>
                      <TableCell>
                        <Select
                          value={q.status}
                          onValueChange={(val) =>
                            updateStatus.mutate({ id: q.id, status: val })
                          }
                        >
                          <SelectTrigger className="h-8 w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(q.created_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setSelectedQuote(q)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteQuote.mutate(q.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="font-medium">No quote requests yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add the widget to your website to start receiving quote requests.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quote Detail Dialog */}
      <Dialog open={!!selectedQuote} onOpenChange={(open) => !open && setSelectedQuote(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quote Request</DialogTitle>
          </DialogHeader>
          {selectedQuote && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium">Name:</span> {selectedQuote.name}
              </div>
              <div>
                <span className="font-medium">Email:</span>{" "}
                <a href={`mailto:${selectedQuote.email}`} className="text-primary underline">
                  {selectedQuote.email}
                </a>
              </div>
              {selectedQuote.phone && (
                <div>
                  <span className="font-medium">Phone:</span> {selectedQuote.phone}
                </div>
              )}
              {selectedQuote.trade && (
                <div>
                  <span className="font-medium">Trade:</span> {selectedQuote.trade}
                </div>
              )}
              {selectedQuote.address && (
                <div>
                  <span className="font-medium">Address:</span> {selectedQuote.address}
                </div>
              )}
              {selectedQuote.message && (
                <div>
                  <span className="font-medium">Message:</span>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {selectedQuote.message}
                  </p>
                </div>
              )}
              <div>
                <span className="font-medium">Status:</span> {statusBadge(selectedQuote.status)}
              </div>
              <div>
                <span className="font-medium">Received:</span>{" "}
                {format(new Date(selectedQuote.created_at), "dd MMM yyyy HH:mm")}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
