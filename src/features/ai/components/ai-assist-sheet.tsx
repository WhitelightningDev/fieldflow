import * as React from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
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
  "Give me a short owner briefing for today.",
  "Summarize my biggest operational risks.",
  "Draft a polite invoice follow-up message.",
  "Spot any anomalies and suggest actions.",
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
      <SheetContent side="right" className="w-full sm:max-w-[440px] p-0 flex flex-col">
        <SheetTitle className="sr-only">AI Assistant</SheetTitle>
        {!gate.hasFeature("ai_job_summaries") ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <Card className="w-full text-center shadow-sm">
              <CardHeader>
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Lock className="h-6 w-6 text-muted-foreground" />
                </div>
                <CardTitle className="text-base">AI Assistant requires Business</CardTitle>
                <CardDescription>
                  Upgrade to Business to unlock AI insights and chat.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button type="button" className="w-full" onClick={() => { closeAssist(); navigate("/subscribe?plan=business"); }}>
                  <Zap className="h-4 w-4 mr-2" /> Upgrade to Business
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : !canUseAiByRole ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <Card className="w-full text-center shadow-sm">
              <CardHeader>
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Lock className="h-6 w-6 text-muted-foreground" />
                </div>
                <CardTitle className="text-base">Access restricted</CardTitle>
                <CardDescription>
                  Only owners, admins, and office staff can use AI tools.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : (
          <AiChatPanel
            title="FieldFlow AI"
            subtitle="Insights, recommendations & drafts"
            messages={chat.messages}
            loading={chat.loading}
            draft={draft}
            setDraft={setDraft}
            onSend={chat.send}
            onClear={chat.clear}
            quickPrompts={QUICK_PROMPTS}
            onAction={(a) => {
              closeAssist();
              navigate(a.to);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
