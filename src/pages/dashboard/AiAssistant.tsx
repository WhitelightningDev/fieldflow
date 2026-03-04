import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { useAuth } from "@/features/auth/hooks/use-auth";
import * as React from "react";
import { Lock } from "lucide-react";
import { useFeatureGate } from "@/features/subscription/hooks/use-feature-gate";
import UpgradePrompt from "@/features/subscription/components/upgrade-prompt";
import { buildAiChatContext } from "@/features/ai/lib/build-ai-context";
import { useAiAssistantChat } from "@/features/ai/hooks/use-ai-assistant-chat";
import { AiChatPanel } from "@/features/ai/components/ai-chat-panel";
import { useNavigate } from "react-router-dom";

export default function AiAssistant() {
  const { data } = useDashboardData();
  const { roles } = useAuth();
  const navigate = useNavigate();
  const company = data.company;
  const gate = useFeatureGate(company?.subscription_tier as any);
  const canUseAi = React.useMemo(() => {
    const allowed = new Set(["owner", "admin", "office_staff"]);
    return (roles ?? []).some((r) => allowed.has(String(r)));
  }, [roles]);

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

  const context = React.useMemo(() => buildAiChatContext(data), [data]);
  const chat = useAiAssistantChat({ enabled: gate.hasFeature("ai_job_summaries") && canUseAi, context });
  const [draft, setDraft] = React.useState("");

  const quickPrompts = React.useMemo(() => ([
    "Give me a short owner briefing for today based on my dashboard.",
    "Summarize the biggest operational risks you see and what to do next.",
    "Draft a polite invoice follow-up message for overdue invoices.",
    "Spot any anomalies in jobs/invoices and suggest actions.",
  ]), []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Assistant"
        subtitle="Chat-style AI for insights, recommendations, and drafts (Business plan)."
      />

      <Card className="bg-card/70 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="h-[70vh] min-h-[520px]">
            <AiChatPanel
              title="FieldFlow AI"
              subtitle="Uses a compact dashboard summary as context."
              messages={chat.messages}
              loading={chat.loading}
              draft={draft}
              setDraft={setDraft}
              onSend={chat.send}
              onClear={chat.clear}
              quickPrompts={quickPrompts}
              onAction={(a) => navigate(a.to)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
