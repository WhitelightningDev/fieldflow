import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "@/components/ui/use-toast";
import { TRADES, type TradeId } from "@/features/company-signup/content/trades";

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
      await new Promise((r) => setTimeout(r, 350));
      toast({
        title: "Company created (demo)",
        description: "Next: connect billing + invite your team.",
      });
      args?.onSuccess?.(values);
    });
  }, [args, form]);

  return { form, submit };
}

