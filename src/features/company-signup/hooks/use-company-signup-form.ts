import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toastSuccess, toastError } from "@/lib/toast-helpers";
import { TRADES, type TradeId } from "@/features/company-signup/content/trades";
import { supabase } from "@/integrations/supabase/client";

const tradeIds = TRADES.map((t) => t.id) as [TradeId, ...TradeId[]];

export const companySignupSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  industry: z.enum(tradeIds, { required_error: "Select an industry" }),
  teamSize: z.enum(["1", "2-5", "6-15", "16-30", "31+"], { required_error: "Select a team size" }),
  contactName: z.string().min(2, "Your name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type CompanySignupValues = z.infer<typeof companySignupSchema>;

type UseCompanySignupFormArgs = {
  defaultIndustry?: TradeId;
  onSuccess?: (values: CompanySignupValues) => void;
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
      // 1. Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { full_name: values.contactName },
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError || !authData.user) {
        toastError("Signup failed", authError?.message ?? "Unknown error");
        return;
      }

      // 2. Create the company
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({
          name: values.companyName,
          industry: values.industry,
          team_size: values.teamSize,
        })
        .select("id")
        .single();

      if (companyError || !company) {
        toastError("Failed to create company", companyError?.message);
        return;
      }

      // 3. Link profile to company
      await supabase
        .from("profiles")
        .update({ company_id: company.id })
        .eq("user_id", authData.user.id);

      // 4. Assign owner role
      await supabase
        .from("user_roles")
        .insert({ user_id: authData.user.id, role: "owner" });

      toastSuccess(
        "Company created!",
        "Check your email to confirm your account, then log in.",
      );
      args?.onSuccess?.(values);
    });
  }, [args, form]);

  return { form, submit };
}
