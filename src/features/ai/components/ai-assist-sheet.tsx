import * as React from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAiAssist } from "@/features/ai/ai-assist-context";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useFeatureGate } from "@/features/subscription/hooks/use-feature-gate";
import { buildAiChatContext } from "@/features/ai/lib/build-ai-context";
import { useAiAssistantChat } from "@/features/ai/hooks/use-ai-assistant-chat";
import { AiChatPanel } from "@/features/ai/components/ai-chat-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const QUICK_PROMPTS = [
  "Give me a short owner briefing for today based on my dashboard.",
  "Summarize the biggest operational risks you see and what to do next.",
  "Draft a polite invoice follow-up message for overdue invoices.",
  "Spot any anomalies in jobs/invoices and suggest actions.",
];

export function AiAssistSheet() {
  const { open, closeAssist, draft, setDraft } = useAiAssist();
  const { data } = useDashboardData();
  const { roles } = useAuth();
  const navigate = useNavigate();

  const gate = useFeatureGate((data.company as any)?.subscription_tier as any);
  const allowedRoles = React.useMemo(() => new Set(["owner", "admin", "office_staff"]), []);
  const canUseAiByRole = React.useMemo(() => (roles ?? []).some((r) => allowedRoles.has(String(r))), [allowedRoles, roles]);
  const canUseAi = gate.hasFeature("ai_job_summaries") && canUseAiByRole;

  const context = React.useMemo(() => buildAiChatContext(data), [data]);
  const chat = useAiAssistantChat({ enabled: canUseAi, context });

  return (
    <Sheet open={open} onOpenChange={(v) => (v ? null : closeAssist())}>
      <SheetContent side="right" className="w-full sm:max-w-[460px] p-0">
        {!gate.hasFeature("ai_job_summaries") ? (
          <div className="p-4">
            <Card className="w-full text-center">
              <CardHeader>
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Lock className="h-6 w-6 text-muted-foreground" />
                </div>
                <CardTitle>AI Assistant requires Business</CardTitle>
                <CardDescription>
                  Upgrade to Business to unlock AI insights and chat across your dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button type="button" className="w-full" onClick={() => navigate("/subscribe?plan=business")}>
                  <Zap className="h-4 w-4 mr-2" /> Upgrade to Business
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : !canUseAiByRole ? (
          <div className="p-4">
            <Card className="w-full text-center">
              <CardHeader>
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Lock className="h-6 w-6 text-muted-foreground" />
                </div>
                <CardTitle>AI Assistant access restricted</CardTitle>
                <CardDescription>
                  Only owners, admins, and office staff can use AI tools.
                </CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </div>
        ) : (
          <AiChatPanel
            title="FieldFlow AI"
            subtitle="Ask for insights, recommendations, and drafts."
            messages={chat.messages}
            loading={chat.loading}
            draft={draft}
            setDraft={setDraft}
            onSend={chat.send}
            onClear={chat.clear}
            quickPrompts={QUICK_PROMPTS}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
