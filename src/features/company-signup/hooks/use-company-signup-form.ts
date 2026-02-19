import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toastSuccess, toastError } from "@/lib/toast-helpers";
import { TRADES, type TradeId } from "@/features/company-signup/content/trades";
import { TEAM_SIZE_VALUES } from "@/features/company-signup/content/team-sizes";
import { supabase } from "@/integrations/supabase/client";
import { getPublicSiteUrl } from "@/lib/public-site-url";

const tradeIds = TRADES.map((t) => t.id) as [TradeId, ...TradeId[]];

export const companySignupSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  industry: z.enum(tradeIds, { required_error: "Select an industry" }),
  teamSize: z.enum(TEAM_SIZE_VALUES, { required_error: "Select a team size" }),
  contactName: z.string().min(2, "Your name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type CompanySignupValues = z.infer<typeof companySignupSchema>;

type UseCompanySignupFormArgs = {
  defaultIndustry?: TradeId;
  onSuccess?: (args: { values: CompanySignupValues; needsEmailConfirm: boolean }) => void;
};

export function useCompanySignupForm(args?: UseCompanySignupFormArgs) {
  const form = useForm<CompanySignupValues>({
    resolver: zodResolver(companySignupSchema),
    defaultValues: {
      companyName: "",
      industry: args?.defaultIndustry ?? TRADES[0].id,
      teamSize: "2-5",
      contactName: "",
      email: "",
      password: "",
    },
    mode: "onTouched",
  });

  const submit = React.useMemo(() => {
    return form.handleSubmit(async (values) => {
      // If someone tries to sign up while already logged in, Supabase may keep the
      // existing session (especially when email confirmation is enabled). That can
      // make it look like the "new company" signup still opens the old company dashboard.
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // ignore
      }

      const { data, error: authError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.contactName,
            company_name: values.companyName,
            industry: values.industry,
            team_size: values.teamSize,
          },
          emailRedirectTo: `${getPublicSiteUrl()}/auth/callback`,
        },
      });

      if (authError) {
        toastError("Signup failed", authError.message);
        return;
      }

      const needsEmailConfirm = !data?.session;
      toastSuccess(
        "Account created",
        needsEmailConfirm
          ? "Check your email to confirm your account, then log in."
          : "Email confirmation is disabled for this project. You can log in now.",
      );
      args?.onSuccess?.({ values, needsEmailConfirm });
    });
  }, [args, form]);

  return { form, submit };
}
