import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TRADES, type TradeId } from "@/features/company-signup/content/trades";
import { TEAM_SIZE_OPTIONS, TEAM_SIZE_VALUES } from "@/features/company-signup/content/team-sizes";
import { COMPANY_SIGNUP_FEATURES } from "@/features/company-signup/content/features";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Building2, CheckCircle2, Rocket, Sparkles } from "lucide-react";

const tradeIds = TRADES.map((t) => t.id) as [TradeId, ...TradeId[]];

const schema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  industry: z.enum(tradeIds, { required_error: "Select an industry" }),
  teamSize: z.enum(TEAM_SIZE_VALUES, { required_error: "Select a team size" }),
});

type Values = z.infer<typeof schema>;

export default function CreateCompany() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, roles, signOut } = useAuth();
  const [checkingExistingCompany, setCheckingExistingCompany] = React.useState(false);
  const [existingCompanyCheckError, setExistingCompanyCheckError] = React.useState<string | null>(null);
  const canCreateCompany = roles.includes("owner") || roles.includes("admin");

  if (!canCreateCompany) {
    return (
      <div className="max-w-lg mx-auto pt-12">
        <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Company creation restricted</h2>
              <p className="text-sm text-muted-foreground mt-1">Only an owner or admin can create a company workspace.</p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" onClick={() => navigate("/dashboard", { replace: true })}>
                Back to dashboard
              </Button>
              <Button variant="ghost" className="text-muted-foreground" onClick={() => void signOut().finally(() => navigate("/login"))}>
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user) return;
      if (!profile?.company_id) return;
      setCheckingExistingCompany(true);
      setExistingCompanyCheckError(null);
      try {
        const { data, error } = await supabase
          .from("companies")
          .select("id")
          .eq("id", profile.company_id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          setExistingCompanyCheckError(error.message ?? "Could not verify existing company link.");
          return;
        }
        if (data?.id) {
          navigate("/dashboard", { replace: true });
          return;
        }
        await supabase.from("profiles").update({ company_id: null }).eq("user_id", user.id);
        await refreshProfile();
      } finally {
        if (!cancelled) setCheckingExistingCompany(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [navigate, profile?.company_id, refreshProfile, user]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: "",
      industry: TRADES[0].id,
      teamSize: "2-5",
    },
    mode: "onTouched",
  });

  const selectedIndustry = form.watch("industry");
  const selectedTrade = TRADES.find((t) => t.id === selectedIndustry);

  const submit = form.handleSubmit(async (values) => {
    if (!user) return;
    if (profile?.company_id) {
      const { data, error } = await supabase
        .from("companies")
        .select("id")
        .eq("id", profile.company_id)
        .maybeSingle();

      if (error) {
        toast({
          title: "Can't verify existing company",
          description: error.message ?? "Database permissions are blocking a company lookup.",
          variant: "destructive",
        });
        return;
      }

      if (data?.id) {
        toast({
          title: "You're already linked to a company",
          description: "Update your company from Settings instead.",
          variant: "destructive",
        });
        navigate("/dashboard/settings", { replace: true });
        return;
      }

      await supabase.from("profiles").update({ company_id: null }).eq("user_id", user.id);
      await refreshProfile();
    }

    const { data: companyId, error } = await supabase.rpc("create_company_for_current_user" as any, {
      _name: values.companyName,
      _industry: values.industry,
      _team_size: values.teamSize,
    });
    if (error || !companyId) {
      const msg = error?.message ?? "Could not create company";
      const isRls = msg.toLowerCase().includes("row-level security");
      toast({
        title: "Error",
        description: isRls ? "Database RLS is blocking company creation. Apply the latest migrations and try again." : msg,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Company created" });
    await supabase.auth.updateUser({
      data: { company_id: companyId, company_name: null, industry: null, team_size: null },
    });
    await supabase.auth.refreshSession();
    await refreshProfile();
    navigate("/dashboard", { replace: true });
  });

  return (
    <div className="min-h-[60vh] flex items-start justify-center pt-4 sm:pt-10">
      <div className="w-full max-w-3xl">
        {/* Hero header */}
        <div className="text-center mb-8 space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center shadow-glow">
            <Rocket className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">Set up your workspace</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Create your company to unlock job cards, invoicing, teams, dispatch, and more.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Main form — takes 3 cols */}
          <Card className="lg:col-span-3 border-border/60 bg-card/70 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-6 sm:p-8 space-y-6">
              {existingCompanyCheckError ? (
                <Alert variant="destructive">
                  <AlertTitle>Company link check failed</AlertTitle>
                  <AlertDescription>{existingCompanyCheckError}</AlertDescription>
                </Alert>
              ) : null}

              <Form {...form}>
                <form onSubmit={submit} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Apex Electrical" className="h-11" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Trade selection as visual cards */}
                  <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry</FormLabel>
                        <FormControl>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {TRADES.map((trade) => {
                              const isSelected = trade.id === field.value;
                              return (
                                <button
                                  key={trade.id}
                                  type="button"
                                  onClick={() => field.onChange(trade.id)}
                                  className={cn(
                                    "flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200",
                                    "hover:bg-secondary/50",
                                    isSelected
                                      ? "border-primary/50 bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                                      : "border-border/60 bg-background/50",
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                      isSelected ? "gradient-bg" : "bg-secondary",
                                    )}
                                  >
                                    <trade.icon
                                      className={cn(
                                        "h-4.5 w-4.5",
                                        isSelected ? "text-primary-foreground" : "text-muted-foreground",
                                      )}
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className={cn("text-sm font-medium", isSelected && "text-primary")}>
                                      {trade.shortName}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">{trade.hook.split("—")[0]}</div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </FormControl>
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
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TEAM_SIZE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-12 text-base gradient-bg hover:opacity-90 shadow-glow font-semibold"
                    disabled={form.formState.isSubmitting || checkingExistingCompany}
                  >
                    {form.formState.isSubmitting ? (
                      "Creating..."
                    ) : checkingExistingCompany ? (
                      "Checking..."
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Create workspace
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Side panel — takes 2 cols */}
          <div className="lg:col-span-2 space-y-4">
            {/* Selected trade highlight */}
            {selectedTrade && (
              <Card className="border-border/60 bg-card/70 backdrop-blur-sm overflow-hidden">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <selectedTrade.icon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">{selectedTrade.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedTrade.hook}</p>
                  <ul className="space-y-1.5">
                    {selectedTrade.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Features */}
            <Card className="border-border/60 bg-card/70 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-5 space-y-3">
                <div className="text-sm font-semibold">What's included</div>
                <ul className="space-y-2.5">
                  {COMPANY_SIGNUP_FEATURES.slice(0, 4).map((f) => (
                    <li key={f.title} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                        <f.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-tight">{f.title}</div>
                        <div className="text-xs text-muted-foreground">{f.description}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
