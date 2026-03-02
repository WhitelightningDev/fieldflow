import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toastError } from "@/lib/toast-helpers";
import { useFeatureGate } from "@/features/subscription/hooks/use-feature-gate";
import type { DashboardData } from "@/features/dashboard/store/dashboard-data-store";
import * as React from "react";
import {
  AlertTriangle,
  Clock,
  DollarSign,
  Flame,
  Loader2,
  Package,
  RefreshCcw,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAiAssist } from "@/features/ai/ai-assist-context";

type Insight = {
  type: "alert" | "suggestion" | "warning" | "tip";
  icon: string;
  title: string;
  body: string;
  severity: "critical" | "warning" | "info";
};

const ICON_MAP: Record<string, React.ElementType> = {
  flame: Flame,
  dollar: DollarSign,
  clock: Clock,
  wrench: Wrench,
  users: Users,
  "alert-triangle": AlertTriangle,
  "trending-up": TrendingUp,
  package: Package,
};

function buildContext(data: DashboardData): string {
  const jobs = data.jobCards ?? [];
  const invoices = data.invoices ?? [];
  const techs = data.technicians ?? [];
  const customers = data.customers ?? [];
  const sites = data.sites ?? [];
  const inventory = data.inventoryItems ?? [];

  const overdue = invoices.filter(
    (i) => i.status !== "paid" && i.sent_at && new Date(i.sent_at) < new Date(Date.now() - 30 * 86400000)
  );
  const unpaid = invoices.filter((i) => i.status !== "paid" && i.total_cents > (i.amount_paid_cents ?? 0));
  const unassigned = jobs.filter((j) => !j.technician_id && !["completed", "invoiced", "cancelled"].includes(j.status));
  const lowStock = inventory.filter((i) => i.quantity_on_hand <= i.reorder_point);

  const techStats = techs.map((t) => {
    const tJobs = jobs.filter((j) => j.technician_id === t.id);
    const completed = tJobs.filter((j) => j.status === "completed" || j.status === "invoiced").length;
    const callbacks = tJobs.filter((j) =>
      String(j.notes ?? "").toLowerCase().match(/callback|return|rework/)
    ).length;
    return {
      name: t.name,
      active: t.active,
      total_jobs: tJobs.length,
      completed,
      callbacks,
      today_jobs: tJobs.filter((j) => {
        if (!j.scheduled_at) return false;
        const d = new Date(j.scheduled_at);
        const now = new Date();
        return d.toDateString() === now.toDateString();
      }).length,
    };
  });

  return JSON.stringify({
    company: {
      name: data.company?.name ?? null,
      industry: data.company?.industry ?? null,
    },
    summary: {
      total_jobs: jobs.length,
      active_jobs: jobs.filter((j) => !["completed", "invoiced", "cancelled"].includes(j.status)).length,
      unassigned_jobs: unassigned.length,
      total_invoices: invoices.length,
      unpaid_invoices: unpaid.length,
      overdue_invoices_30d: overdue.length,
      overdue_total_cents: overdue.reduce((s, i) => s + (i.total_cents - (i.amount_paid_cents ?? 0)), 0),
      unpaid_total_cents: unpaid.reduce((s, i) => s + (i.total_cents - (i.amount_paid_cents ?? 0)), 0),
      total_customers: customers.length,
      total_sites: sites.length,
      low_stock_count: lowStock.length,
      total_technicians: techs.length,
      active_technicians: techs.filter((t) => t.active).length,
    },
    technician_performance: techStats.slice(0, 10),
    recent_jobs: jobs.slice(0, 8).map((j) => ({
      title: j.title,
      status: j.status,
      priority: j.priority,
      scheduled_at: j.scheduled_at,
      has_technician: !!j.technician_id,
    })),
    low_stock_items: lowStock.slice(0, 5).map((i) => ({
      name: i.name,
      on_hand: i.quantity_on_hand,
      reorder_at: i.reorder_point,
    })),
  });
}

export function AiInsightsCard({ data }: { data: DashboardData }) {
  const gate = useFeatureGate(data.company?.subscription_tier as any);
  const { openAssist } = useAiAssist();
  const [insights, setInsights] = React.useState<Insight[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fetchedRef = React.useRef(false);

  const fetchInsights = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const context = buildContext(data);
      const { data: fnData, error: fnError } = await supabase.functions.invoke("ai-assistant", {
        body: { mode: "insights", context },
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
          } catch { /* ignore */ }
          if (res.status === 403) {
            setError("Business plan required");
            return;
          }
        }
        setError(details);
        return;
      }

      const arr = (fnData as any)?.insights;
      if (Array.isArray(arr) && arr.length > 0) {
        setInsights(arr.slice(0, 6));
      } else {
        setInsights([{
          type: "tip",
          icon: "trending-up",
          title: "All looks good!",
          body: "No critical issues detected. Keep up the great work.",
          severity: "info",
        }]);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, [data]);

  React.useEffect(() => {
    if (!gate.hasFeature("ai_job_summaries")) return;
    if (fetchedRef.current) return;
    // Only fetch when we have meaningful data
    if ((data.jobCards?.length ?? 0) === 0 && (data.customers?.length ?? 0) === 0) return;
    fetchedRef.current = true;
    fetchInsights();
  }, [gate, data.jobCards?.length, data.customers?.length, fetchInsights]);

  if (!gate.hasFeature("ai_job_summaries")) return null;

  const severityStyles: Record<string, string> = {
    critical: "border-destructive/30 bg-destructive/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    info: "border-primary/20 bg-primary/5",
  };

  return (
    <Card className="bg-card/70 backdrop-blur-sm border-primary/20" data-tour="overview-ai-insights">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Insights
            <Badge variant="secondary" className="text-[10px]">Business</Badge>
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => { fetchedRef.current = false; fetchInsights(); }}
              disabled={loading}
            >
              <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => openAssist({ prompt: "Give me a short owner briefing for today based on my dashboard." })}
            >
              Open chat
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && insights.length === 0 ? (
          <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing your dashboard…
          </div>
        ) : error ? (
          <div className="text-sm text-muted-foreground py-4 text-center">{error}</div>
        ) : (
          insights.map((insight, idx) => {
            const Icon = ICON_MAP[insight.icon] ?? Sparkles;
            return (
              <div
                key={idx}
                className={cn(
                  "rounded-lg border p-3 flex items-start gap-3",
                  severityStyles[insight.severity] ?? severityStyles.info,
                )}
              >
                <Icon className={cn(
                  "h-4 w-4 mt-0.5 shrink-0",
                  insight.severity === "critical" ? "text-destructive" :
                  insight.severity === "warning" ? "text-amber-500" : "text-primary"
                )} />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{insight.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{insight.body}</div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
