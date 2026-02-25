import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toastError } from "@/lib/toast-helpers";
import * as React from "react";
import { Loader2, Lock, Sparkles } from "lucide-react";
import { useFeatureGate } from "@/features/subscription/hooks/use-feature-gate";
import UpgradePrompt from "@/features/subscription/components/upgrade-prompt";

type ChatMessage = { role: "user" | "assistant"; text: string };
type JobCard = Tables<"job_cards">;
type Invoice = Tables<"invoices">;

function safeJsonStringify(value: unknown, maxLen = 6000) {
  try {
    const s = JSON.stringify(value, null, 2);
    return s.length > maxLen ? `${s.slice(0, maxLen)}\n…(truncated)` : s;
  } catch {
    return "";
  }
}

export default function AiAssistant() {
  const { data } = useDashboardData();
  const { roles } = useAuth();
  const company = data.company;
  const gate = useFeatureGate(company?.subscription_tier as any);
  const canUseAi = React.useMemo(() => {
    const allowed = new Set(["owner", "admin", "office_staff"]);
    return (roles ?? []).some((r) => allowed.has(String(r)));
  }, [roles]);
  const [prompt, setPrompt] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);

  if (!gate.hasFeature("ai_job_summaries")) {
    return <UpgradePrompt feature="AI Assistant" requiredTier="business" currentTier={gate.tier as any} />;
  }

  if (!canUseAi) {
    return (
      <div className="flex items-center justify-center py-16">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>AI Assistant access restricted</CardTitle>
            <CardDescription>
              Only owners, admins, and office staff can use AI tools.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const context = React.useMemo(() => {
    // Keep context small and useful; this is a placeholder and not a full data export.
    const recentJobs = ((data.jobCards ?? []) as JobCard[])
      .slice(0, 10)
      .map((j) => ({
        id: j.id,
        title: j.title,
        status: j.status,
        scheduled_at: j.scheduled_at ?? null,
        technician_id: j.technician_id ?? null,
        site_id: j.site_id ?? null,
        customer_id: j.customer_id ?? null,
      }));
    const recentInvoices = ((data.invoices ?? []) as Invoice[])
      .slice(0, 10)
      .map((i) => ({
        id: i.id,
        status: i.status ?? null,
        total_cents: i.total_cents ?? null,
        amount_paid_cents: i.amount_paid_cents ?? null,
        sent_at: i.sent_at ?? null,
        customer_id: i.customer_id ?? null,
      }));

    return safeJsonStringify({
      company: {
        id: company?.id ?? null,
        name: company?.name ?? null,
        industry: company?.industry ?? null,
        subscription_tier: company?.subscription_tier ?? null,
        included_techs: company?.included_techs ?? null,
        per_tech_price_cents: company?.per_tech_price_cents ?? null,
      },
      counts: {
        technicians_total: (data.technicians ?? []).length,
        technicians_active: (data.technicians ?? []).filter((t) => Boolean(t.active)).length,
        jobs_total: (data.jobCards ?? []).length,
        invoices_total: (data.invoices ?? []).length,
        customers_total: (data.customers ?? []).length,
        sites_total: (data.sites ?? []).length,
      },
      recentJobs,
      recentInvoices,
    });
  }, [company, data.customers, data.invoices, data.jobCards, data.sites, data.technicians]);

  const quickPrompts = [
    "Give me a short owner briefing for today based on my dashboard.",
    "Summarize the biggest operational risks you see and what to do next.",
    "Draft a polite invoice follow-up message for overdue invoices.",
    "Spot any anomalies in jobs/invoices and suggest actions.",
  ];

  const send = async () => {
    if (!gate.hasFeature("ai_job_summaries") || !canUseAi) {
      toastError("AI request blocked", "Your plan or role does not allow AI access.");
      return;
    }
    const text = prompt.trim();
    if (!text) return;
    setPrompt("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("ai-assistant", {
        body: { message: text, context },
      });
      if (fnError) {
        let details = fnError.message;
        const ctx: any = (fnError as any).context;
        const res: Response | undefined = ctx?.response;
        if (res) {
          try {
            const raw = await res.text();
            const parsed = raw ? JSON.parse(raw) : null;
            details = parsed?.error ?? parsed?.hint ?? raw ?? details;
          } catch {
            // ignore
          }
          if (res.status === 404) {
            details = 'Edge function "ai-assistant" is not deployed.';
          }
        }
        toastError("AI request failed", details);
        return;
      }
      const out = (fnData as any)?.text as string | undefined;
      setMessages((prev) => [...prev, { role: "assistant", text: out?.trim() || "No response." }]);
    } catch (e: any) {
      toastError("AI request failed", e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Assistant"
        subtitle="AI tools for owners/admins/office staff (Business plan)."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 bg-card/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Quick actions
            </CardTitle>
            <CardDescription>Click to load a prompt.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickPrompts.map((p) => (
              <Button
                key={p}
                type="button"
                variant="outline"
                className="w-full justify-start text-left whitespace-normal h-auto"
                onClick={() => setPrompt(p)}
                disabled={loading}
              >
                {p}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 bg-card/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Chat</CardTitle>
            <CardDescription>
              Context is sent in a compact JSON summary (recent jobs/invoices + counts).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-background/40 p-3 space-y-3 min-h-[260px] max-h-[420px] overflow-y-auto">
              {messages.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Ask something like: “What should I focus on today?” or use a quick action.
                </div>
              ) : null}
              {messages.map((m, idx) => (
                <div key={idx} className="text-sm">
                  <div className="text-xs text-muted-foreground mb-1">
                    {m.role === "user" ? "You" : "AI"}
                  </div>
                  <div className="whitespace-pre-wrap">{m.text}</div>
                </div>
              ))}
              {loading ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask FieldFlow AI…"
                rows={4}
                disabled={loading}
              />
              <div className="flex justify-end">
                <Button
                  onClick={() => void send()}
                  disabled={loading || prompt.trim().length === 0}
                  className="gradient-bg hover:opacity-90 shadow-glow"
                >
                  {loading ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
