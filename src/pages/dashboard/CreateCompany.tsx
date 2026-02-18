import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { TRADES, type TradeId } from "@/features/company-signup/content/trades";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

const tradeIds = TRADES.map((t) => t.id) as [TradeId, ...TradeId[]];

const schema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  industry: z.enum(tradeIds, { required_error: "Select an industry" }),
  teamSize: z.enum(["1", "2-5", "6-15", "16-30", "31+"], { required_error: "Select a team size" }),
});

type Values = z.infer<typeof schema>;

export default function CreateCompany() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  React.useEffect(() => {
    if (profile?.company_id) navigate("/dashboard", { replace: true });
  }, [navigate, profile?.company_id]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: "",
      industry: TRADES[0].id,
      teamSize: "2-5",
    },
    mode: "onTouched",
  });

  const submit = form.handleSubmit(async (values) => {
    if (!user) return;

    const { data: companyId, error } = await supabase.rpc("create_company_for_current_user" as any, {
      _name: values.companyName,
      _industry: values.industry,
      _team_size: values.teamSize,
    });
    if (error || !companyId) {
      const msg = error?.message ?? "Could not create company";
      const isRls = msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("violates row level security");
      toast({
        title: "Error",
        description: isRls ? "Database RLS is blocking company creation. Apply the latest Supabase migrations and try again." : msg,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Company created" });
    await refreshProfile();
    navigate("/dashboard", { replace: true });
  });

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Create company</CardTitle>
          <CardDescription>Set up your workspace. You can start creating job cards immediately.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={submit} className="space-y-4">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Apex Electrical" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TRADES.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="teamSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team size</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">Just me</SelectItem>
                          <SelectItem value="2-5">2–5 techs</SelectItem>
                          <SelectItem value="6-15">6–15 techs</SelectItem>
                          <SelectItem value="16-30">16–30 techs</SelectItem>
                          <SelectItem value="31+">31+ techs</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="submit" className="gradient-bg hover:opacity-90 shadow-glow" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Creating..." : "Create company"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
