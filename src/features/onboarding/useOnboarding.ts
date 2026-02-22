import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import type { OnboardingController, TutorialStep, UserOnboardingRow } from "@/features/onboarding/types";

type Args = {
  userId: string | null | undefined;
  companyId: string | null | undefined;
  tutorialKey: string | null;
  steps: TutorialStep[];
};

async function ensureRow(args: { userId: string; companyId: string; tutorialKey: string }): Promise<UserOnboardingRow> {
  const { userId, companyId, tutorialKey } = args;

  const existing = await supabase
    .from("user_onboarding" as any)
    .select("*")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("tutorial_key", tutorialKey)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as any;

  const created = await supabase
    .from("user_onboarding" as any)
    .insert({
      user_id: userId,
      company_id: companyId,
      tutorial_key: tutorialKey,
      current_step: 0,
      is_completed: false,
      completed_at: null,
    })
    .select("*")
    .single();

  if (!created.error) return created.data as any;

  // Race-safe fallback for the unique constraint (two tabs, refresh during insert, etc.)
  const code = (created.error as any)?.code;
  if (code === "23505") {
    const retry = await supabase
      .from("user_onboarding" as any)
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .eq("tutorial_key", tutorialKey)
      .single();
    if (retry.error) throw retry.error;
    return retry.data as any;
  }

  throw created.error;
}

export function useOnboarding({ userId, companyId, tutorialKey, steps }: Args): OnboardingController {
  const queryClient = useQueryClient();

  const enabled = Boolean(userId && companyId && tutorialKey && steps.length > 0);
  const queryKey = React.useMemo(() => ["user_onboarding", userId, companyId, tutorialKey], [userId, companyId, tutorialKey]);

  const rowQuery = useQuery({
    queryKey,
    enabled,
    queryFn: () => ensureRow({ userId: userId!, companyId: companyId!, tutorialKey: tutorialKey! }),
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: Partial<Pick<UserOnboardingRow, "current_step" | "is_completed" | "completed_at">>) => {
      const row = rowQuery.data;
      if (!row) throw new Error("Onboarding row not loaded");
      const res = await supabase
        .from("user_onboarding" as any)
        .update(patch)
        .eq("id", row.id)
        .select("*")
        .single();
      if (res.error) throw res.error;
      return res.data as any as UserOnboardingRow;
    },
    onSuccess: (nextRow) => {
      queryClient.setQueryData(queryKey, nextRow);
    },
    onError: (err: any) => {
      toast({
        title: "Onboarding update failed",
        description: String(err?.message ?? err),
        variant: "destructive",
      });
    },
  });

  const row = (rowQuery.data ?? null) as UserOnboardingRow | null;
  const isCompleted = Boolean(row?.is_completed);

  const currentStepIndex = React.useMemo(() => {
    const raw = row?.current_step ?? 0;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    if (steps.length === 0) return 0;
    return Math.min(n, steps.length - 1);
  }, [row?.current_step, steps.length]);

  const isLoading = rowQuery.isLoading || updateMutation.isPending;
  const isOpen = enabled && !isLoading && Boolean(row) && !isCompleted;

  const activeStep = isOpen ? (steps[currentStepIndex] ?? null) : null;

  const next = React.useCallback(() => {
    if (!row || isLoading) return;
    if (steps.length === 0) return;
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= steps.length) {
      updateMutation.mutate({ is_completed: true, completed_at: new Date().toISOString() });
      return;
    }
    updateMutation.mutate({ current_step: nextIndex });
  }, [row, isLoading, steps.length, currentStepIndex, updateMutation]);

  const back = React.useCallback(() => {
    if (!row || isLoading) return;
    const prev = Math.max(0, currentStepIndex - 1);
    updateMutation.mutate({ current_step: prev });
  }, [row, isLoading, currentStepIndex, updateMutation]);

  const skip = React.useCallback(() => {
    if (!row || isLoading) return;
    updateMutation.mutate({ is_completed: true, completed_at: new Date().toISOString() });
  }, [row, isLoading, updateMutation]);

  const finish = React.useCallback(() => {
    if (!row || isLoading) return;
    updateMutation.mutate({ is_completed: true, completed_at: new Date().toISOString() });
  }, [row, isLoading, updateMutation]);

  const replay = React.useCallback(() => {
    if (!row || isLoading) return;
    updateMutation.mutate({ current_step: 0, is_completed: false, completed_at: null });
  }, [row, isLoading, updateMutation]);

  return {
    tutorialKey: enabled ? tutorialKey! : null,
    steps,
    currentStepIndex,
    isCompleted,
    isLoading,
    isOpen,
    activeStep,
    row,
    actions: { next, back, skip, finish, replay },
  };
}

