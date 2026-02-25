import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Crown, Zap, CreditCard, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { type PlanTier, PLANS, getPlan, formatZar } from "@/features/subscription/plans";
import { TRADES, type TradeId } from "@/features/company-signup/content/trades";
import { supabase } from "@/integrations/supabase/client";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import { toastSuccess, toastError } from "@/lib/toast-helpers";
import { withTimeout } from "@/lib/with-timeout";
import { useAuth } from "@/features/auth/hooks/use-auth";

type Step = "plan" | "info" | "payment";

export default function PackageSignupFlow({ initialTier }: { initialTier?: PlanTier }) {
  const { session, profile } = useAuth();
  const isUpgradeFlow = Boolean(session?.user && profile?.company_id);
  const companyId = profile?.company_id ?? null;
  const [step, setStep] = React.useState<Step>(initialTier ? "info" : "plan");
  const [tier, setTier] = React.useState<PlanTier>(initialTier ?? "pro");
  const [loading, setLoading] = React.useState(false);

  // Company info
  const [companyName, setCompanyName] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [industry, setIndustry] = React.useState<TradeId>("electrical-contracting");

  const plan = getPlan(tier);

  const canProceedInfo =
    isUpgradeFlow ||
    (companyName.trim().length >= 2 &&
      contactName.trim().length >= 2 &&
      email.includes("@") &&
      password.length >= 8);

  React.useEffect(() => {
    if (!isUpgradeFlow) return;
    // For upgrades, skip the company info step entirely.
    setStep("plan");
  }, [isUpgradeFlow]);

  const handleMockPayment = async () => {
    setLoading(true);
    try {
      if (isUpgradeFlow) {
        if (!companyId) {
          toastError("Upgrade failed", "No company found for your account. Please re-login.");
          return;
        }

        const { error: subErr } = await supabase
          .from("companies")
          .update({
            subscription_status: "active",
            subscription_tier: tier,
            per_tech_price_cents: plan.perTechPriceCents,
            included_techs: 1,
          } as any)
          .eq("id", companyId);

        if (subErr) {
          toastError("Could not activate subscription", subErr.message);
          return;
        }

        toastSuccess("Subscription updated!", `You're now on the ${plan.name} plan.`);
        window.location.href = "/dashboard/settings";
        return;
      }

      // Sign out any existing session
      try { await supabase.auth.signOut({ scope: "local" }); } catch {}

      // Create account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: contactName,
            company_name: companyName,
            industry,
            team_size: "1",
            // Persist the intended subscription so it can be applied after email confirmation.
            subscription_tier: tier,
            subscription_status: "active",
            per_tech_price_cents: plan.perTechPriceCents,
            included_techs: 1,
          },
          emailRedirectTo: `${getPublicSiteUrl()}/auth/callback`,
        },
      });

      if (authError) {
        toastError("Signup failed", authError.message);
        return;
      }

      const needsEmailConfirm = !authData?.session;

      if (authData?.session) {
        const userId = authData.session.user.id;

        // Ensure the DB-side profile/company/roles are created/linked before we update subscription state.
        // Without this, `profiles.company_id` is often still null immediately after signup.
        try {
          const res: any = await withTimeout(
            Promise.resolve(supabase.rpc("ensure_user_role" as any)),
            8000,
            "Account setup timed out.",
          );
          if (res?.error) {
            // Non-fatal: we can still attempt to resolve the company below, but inserts may fail under RLS.
            console.warn("ensure_user_role RPC error", res.error);
          }
        } catch (e) {
          console.warn("ensure_user_role RPC call failed", e);
        }

        const resolveCompanyId = async () => {
          let lastErr: any = null;
          for (let attempt = 0; attempt < 12; attempt++) {
            const { data: profile, error } = await supabase
              .from("profiles")
              .select("company_id")
              .eq("user_id", userId)
              .maybeSingle();
            if (error) lastErr = error;
            if (profile?.company_id) return profile.company_id as string;
            await new Promise((r) => window.setTimeout(r, 350));
          }

          // Fallback: create company directly if metadata provisioning didn't happen for some reason.
          const { data: companyId, error } = await supabase.rpc("create_company_for_current_user" as any, {
            _name: companyName,
            _industry: industry,
            _team_size: "1",
          });
          if (error) {
            throw new Error(error.message ?? lastErr?.message ?? "Could not resolve company");
          }
          return companyId as string;
        };

        let companyId: string | null = null;
        try {
          companyId = await resolveCompanyId();
        } catch (e: any) {
          toastError(
            "Account created, but setup failed",
            e?.message ?? "We couldn't link your account to a company yet. Please try logging in again.",
          );
          return;
        }

        // Best-effort: clear stale signup metadata and store the resolved company_id in auth metadata
        // so `ensure_user_role()` won't ever resurrect a ghost company from old JWT metadata.
        try {
          await supabase.auth.updateUser({
            data: {
              company_id: companyId,
              company_name: null,
              industry: null,
              team_size: null,
              subscription_tier: null,
              subscription_status: null,
              per_tech_price_cents: null,
              included_techs: null,
            },
          });
          await supabase.auth.refreshSession();
        } catch {}

        // Update company with subscription info
        const { error: subErr } = await supabase
          .from("companies")
          .update({
            subscription_status: "active",
            subscription_tier: tier,
            per_tech_price_cents: plan.perTechPriceCents,
            included_techs: 1,
          } as any)
          .eq("id", companyId);
        if (subErr) {
          toastError("Could not activate subscription", subErr.message);
          return;
        }
      }

      try {
        localStorage.setItem("ff-last-signup-email", email);
        localStorage.setItem("ff-last-signup-at", new Date().toISOString());
      } catch {}

      if (needsEmailConfirm) {
        // If email confirmation is enabled, we won't have a session yet to update the company row.
        // Store a short-lived "pending upgrade" so we can apply it right after the user confirms and logs in.
        try {
          localStorage.setItem("ff_pending_subscription_tier", tier);
          localStorage.setItem("ff_pending_subscription_email", email);
          localStorage.setItem("ff_pending_subscription_at", new Date().toISOString());
        } catch {}

        toastSuccess(
          "Account created!",
          "Check your email to confirm your account, then log in.",
        );
        window.location.href = "/login";
      } else {
        try {
          localStorage.removeItem("ff_pending_subscription_tier");
          localStorage.removeItem("ff_pending_subscription_email");
          localStorage.removeItem("ff_pending_subscription_at");
        } catch {}

        toastSuccess("Payment successful!", "Your account is now active.");
        window.location.href = "/dashboard/technicians";
      }
    } catch (err: any) {
      toastError("Something went wrong", err?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl space-y-6">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {(["plan", "info", "payment"] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <div className="w-8 h-px bg-border" />}
              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* STEP 1: Plan Selection */}
        {step === "plan" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">{isUpgradeFlow ? "Upgrade your plan" : "Choose your plan"}</h1>
              <p className="text-muted-foreground">
                {isUpgradeFlow ? "Select a new plan and confirm the change" : "Select the plan that fits your business"}
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {PLANS.map((p) => (
                <Card
                  key={p.tier}
                  className={`relative cursor-pointer transition-all ${
                    tier === p.tier ? "border-primary shadow-lg ring-2 ring-primary/20" : "hover:border-primary/50"
                  } ${p.popular ? "border-primary" : ""}`}
                  onClick={() => setTier(p.tier)}
                >
                  {p.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Crown className="h-3 w-3 mr-1" /> Most popular
                    </Badge>
                  )}
                  <CardHeader className="text-center">
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                    <div className="pt-2">
                      <span className="text-3xl font-bold">{formatZar(p.basePriceCents)}</span>
                      <span className="text-muted-foreground text-sm">/mo</span>
                    </div>
                    <CardDescription className="text-xs">
                      + {formatZar(p.perTechPriceCents)}/extra technician
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {p.featureLabels.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex justify-center">
              <Button onClick={() => setStep(isUpgradeFlow ? "payment" : "info")} size="lg">
                Continue with {getPlan(tier).name} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Company Info */}
        {step === "info" && !isUpgradeFlow && (
          <div className="max-w-md mx-auto space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Company details</h1>
              <p className="text-muted-foreground">Tell us about your business</p>
            </div>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label>Company name</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Electrical" />
                </div>
                <div className="space-y-2">
                  <Label>Your name</Label>
                  <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="John Smith" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@acme.co.za" />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" />
                </div>
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Select value={industry} onValueChange={(v) => setIndustry(v as TradeId)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRADES.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.shortName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("plan")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep("payment")} disabled={!canProceedInfo}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Mock Payment */}
        {step === "payment" && (
          <div className="max-w-md mx-auto space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Complete your subscription</h1>
              <p className="text-muted-foreground">Review and confirm your order</p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>{plan.name} plan (monthly)</span>
                  <span className="font-medium">{formatZar(plan.basePriceCents)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Includes 1 technician. Additional active technicians are billed at {formatZar(plan.perTechPriceCents)}/mo each.
                </div>
                <div className="flex justify-between font-bold border-t border-border pt-2">
                  <span>Total per month</span>
                  <span>{formatZar(plan.basePriceCents)}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="h-5 w-5" /> Payment details
                </CardTitle>
                <CardDescription>This is a demo — no real charges will occur</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Card number</Label>
                  <Input placeholder="4242 4242 4242 4242" defaultValue="4242 4242 4242 4242" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Expiry</Label>
                    <Input placeholder="12/28" defaultValue="12/28" />
                  </div>
                  <div className="space-y-2">
                    <Label>CVC</Label>
                    <Input placeholder="123" defaultValue="123" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(isUpgradeFlow ? "plan" : "info")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={handleMockPayment} disabled={loading} size="lg">
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                  <><Zap className="mr-2 h-4 w-4" /> {isUpgradeFlow ? "Confirm upgrade" : `Pay ${formatZar(plan.basePriceCents)}/mo`}</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
