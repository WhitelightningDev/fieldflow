import * as React from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/brand/brand-mark";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ResolvedQuoteLink = {
  company_name: string | null;
  company_logo_url: string | null;
};

const TRADE_OPTIONS = [
  { value: "electrical-contracting", label: "Electrical" },
  { value: "plumbing", label: "Plumbing" },
  { value: "mobile-mechanics", label: "Mobile Mechanics" },
  { value: "refrigeration", label: "Refrigeration" },
  { value: "appliance-repair", label: "Appliance Repair" },
];

export default function QuoteRequestPublic() {
  const { token } = useParams();

  const {
    data: resolved,
    isLoading: resolving,
    isError: resolveErrored,
  } = useQuery({
    queryKey: ["resolve_quote_link", token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resolve_quote_link" as any, { _token: token });
      if (error) throw error;
      const row = Array.isArray(data) ? (data[0] as ResolvedQuoteLink | undefined) : (data as ResolvedQuoteLink | null);
      return row ?? null;
    },
    retry: false,
  });

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [trade, setTrade] = React.useState<string>("");
  const [address, setAddress] = React.useState("");
  const [message, setMessage] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [unavailable, setUnavailable] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string>("");

  const companyName = resolved?.company_name ?? null;
  const companyLogoUrl = resolved?.company_logo_url ?? null;
  const linkInvalid = !!token && !resolving && !resolveErrored && !resolved;

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-quote-request`;

  const canSubmit = !submitting && !!token && !!name.trim() && !!email.trim();

  React.useEffect(() => {
    const title = companyName ? `Request a Quote | ${companyName} (FieldFlow)` : "Request a Quote | FieldFlow";
    const description = companyName
      ? `Send a quote request to ${companyName}. Powered by FieldFlow.`
      : "Send a quote request. Powered by FieldFlow.";

    try {
      document.title = title;
    } catch {
      // ignore
    }

    const coverImage = (() => {
      try {
        return new URL("/FieldFlow-request-a-quote.png", window.location.origin).toString();
      } catch {
        return "/FieldFlow-request-a-quote.png";
      }
    })();

    const setMeta = (attr: "name" | "property", key: string, content: string) => {
      try {
        const selector = `meta[${attr}="${key}"]`;
        let el = document.querySelector(selector) as HTMLMetaElement | null;
        if (!el) {
          el = document.createElement("meta");
          el.setAttribute(attr, key);
          document.head.appendChild(el);
        }
        el.setAttribute("content", content);
      } catch {
        // ignore
      }
    };

    const setCanonical = (url: string) => {
      try {
        let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
        if (!el) {
          el = document.createElement("link");
          el.setAttribute("rel", "canonical");
          document.head.appendChild(el);
        }
        el.setAttribute("href", url);
      } catch {
        // ignore
      }
    };

    setMeta("name", "description", description);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:image", coverImage);
    setMeta("property", "og:image:alt", "FieldFlow quote request");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", coverImage);

    try {
      setCanonical(window.location.href);
      setMeta("property", "og:url", window.location.href);
    } catch {
      // ignore
    }
  }, [companyName]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setErrorText("");
    setUnavailable(false);

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) return setErrorText("Please enter your full name.");
    if (!cleanEmail || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(cleanEmail)) {
      return setErrorText("Please enter a valid email address.");
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_link_token: token,
          name: cleanName,
          email: cleanEmail,
          phone: phone.trim() || null,
          trade: trade.trim() || null,
          address: address.trim() || null,
          message: message.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403) {
          setUnavailable(true);
          return;
        }
        throw new Error((data as any)?.error || "Something went wrong. Please try again.");
      }

      setSuccess(true);
    } catch (err: any) {
      setErrorText(err?.message || "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="flex items-center justify-center">
          <BrandMark />
        </div>

        <div className="mt-6">
          <Card className="border-border/60 shadow-lg">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl">Request a Quote</CardTitle>
              <CardDescription>
                {resolving ? (
                  "Loading…"
                ) : companyName ? (
                  <>
                    Sending to <span className="font-medium text-foreground">{companyName}</span>.
                  </>
                ) : (
                  "Fill in the details below and we will get back to you shortly."
                )}
              </CardDescription>
              {companyLogoUrl ? (
                <div className="pt-1">
                  <img
                    src={companyLogoUrl}
                    alt={companyName ? `${companyName} logo` : "Company logo"}
                    className="h-10 w-auto object-contain"
                    loading="lazy"
                  />
                </div>
              ) : null}
            </CardHeader>

            <CardContent>
              {!token ? (
                <div className="text-sm text-muted-foreground">Invalid quote link.</div>
              ) : linkInvalid || unavailable ? (
                <div className="text-sm text-muted-foreground">This quote form is unavailable.</div>
              ) : success ? (
                <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-5 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 text-xl font-black">
                    &#10003;
                  </div>
                  <div className="text-base font-semibold">Quote Request Sent</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    We have received your request and will be in touch soon.
                  </div>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">
                      Full Name <span className="text-destructive">*</span>
                    </label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoComplete="name" />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">
                      Email <span className="text-destructive">*</span>
                    </label>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} autoComplete="email" />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Phone</label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} autoComplete="tel" />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Trade / Service</label>
                    <Select value={trade} onValueChange={setTrade}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a trade (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {TRADE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Address</label>
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      maxLength={500}
                      autoComplete="street-address"
                    />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Message</label>
                    <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
                  </div>

                  {errorText ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {errorText}
                    </div>
                  ) : null}

                  <Button type="submit" className="w-full" disabled={!canSubmit}>
                    {submitting ? "Sending..." : "Send Quote Request"}
                  </Button>

                  <div className="text-xs text-muted-foreground">
                    By submitting, you agree that we can contact you about this request. Powered by FieldFlow.
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
