import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";

export function useTechData() {
  const { user, profile } = useAuth();
  const [techId, setTechId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    supabase
      .from("technicians")
      .select("id")
      .eq("user_id", user.id)
      .single()
      .then(({ data: tech }) => {
        setTechId(tech?.id ?? null);
        setLoading(false);
      });
  }, [user]);

  return { techId, loading, companyId: profile?.company_id ?? null };
}
