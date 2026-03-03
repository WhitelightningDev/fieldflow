import AuthLayout from "@/features/auth/components/auth-layout";
import LoginForm from "@/features/auth/components/login-form";
import { useAuth } from "@/features/auth/hooks/use-auth";
import TradeBadges from "@/features/company-signup/components/trade-badges";
import { COMPANY_SIGNUP_FEATURES } from "@/features/company-signup/content/features";
import { CheckCircle2, Building2, Wrench, UserCircle } from "lucide-react";
import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type LoginMode = "company" | "technician" | "customer";

const MODE_META: Record<LoginMode, { icon: React.ElementType; label: string; subtitle: string; side: React.ReactNode }> = {
  company: {
    icon: Building2,
    label: "Company",
    subtitle: "Manage jobs, teams, and billing.",
    side: (
      <div className="space-y-8">
        <TradeBadges />
        <div className="space-y-3">
          <div className="text-sm font-semibold">Why teams choose FieldFlow</div>
          <ul className="space-y-2">
            {COMPANY_SIGNUP_FEATURES.slice(0, 4).map((feature) => (
              <li key={feature.title} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                <span>
                  <span className="text-foreground font-medium">{feature.title}:</span> {feature.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    ),
  },
  technician: {
    icon: Wrench,
    label: "Technician",
    subtitle: "View your assigned jobs and log work.",
    side: (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="text-sm font-semibold">Technician app features</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5" /><span>View and manage assigned jobs on the go</span></li>
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5" /><span>Track time, photos, and checklists per job</span></li>
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5" /><span>Generate invoices and capture signatures</span></li>
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5" /><span>Real-time notifications for new assignments</span></li>
          </ul>
        </div>
        <div className="rounded-lg border border-border/40 bg-muted/20 p-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Invited by your company?</span>{" "}
          Check your email for a sign-up link, or log in with your credentials below.
        </div>
      </div>
    ),
  },
  customer: {
    icon: UserCircle,
    label: "Customer",
    subtitle: "Track your quotes, jobs, and invoices.",
    side: (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="text-sm font-semibold">Customer portal features</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5" /><span>Track all your quote requests in one place</span></li>
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5" /><span>See technician assignments and scheduling</span></li>
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5" /><span>View and pay invoices online</span></li>
            <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5" /><span>Get real-time updates via notifications</span></li>
          </ul>
        </div>
        <div className="rounded-lg border border-border/40 bg-muted/20 p-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">No password needed!</span>{" "}
          Use the "Email me a login link" option for quick access to your quote portal.
        </div>
      </div>
    ),
  },
};

export default function Login() {
  const { session, user, loading, roles, rolesLoading, rolesError, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const reason = React.useMemo(() => {
    const qs = new URLSearchParams(location.search.startsWith("?") ? location.search.slice(1) : location.search);
    return qs.get("reason");
  }, [location.search]);

  const initialMode = React.useMemo<LoginMode>(() => {
    const qs = new URLSearchParams(location.search.startsWith("?") ? location.search.slice(1) : location.search);
    const m = qs.get("mode");
    if (m === "technician" || m === "customer" || m === "company") return m;
    return "company";
  }, [location.search]);

  const [mode, setMode] = React.useState<LoginMode>(initialMode);
  const meta = MODE_META[mode];

  const roleSet = React.useMemo(() => new Set(roles), [roles]);
  const isAssociated = React.useMemo(
    () =>
      roleSet.has("owner") ||
      roleSet.has("admin") ||
      roleSet.has("office_staff") ||
      roleSet.has("technician") ||
      roleSet.has("customer"),
    [roleSet],
  );
  const isTech = React.useMemo(() => roleSet.has("technician"), [roleSet]);
  const isCustomer = React.useMemo(() => roleSet.has("customer"), [roleSet]);

  const hardReset = React.useCallback(async () => {
    try { await signOut(); } catch {}
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.allSettled(keys.map((k) => caches.delete(k)));
      }
    } catch {}
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(regs.map((r) => r.unregister()));
      }
    } catch {}
    window.location.replace("/login");
  }, [signOut]);

  React.useEffect(() => {
    if (loading || rolesLoading || !session || !user) return;
    if (!isAssociated) {
      try {
        sessionStorage.setItem(
          "ff-auth-debug",
          JSON.stringify({ at: new Date().toISOString(), userId: user.id, roles, rolesError: rolesError ?? null }),
        );
      } catch {}
      void signOut().finally(() => {
        navigate("/login?reason=unauthorized", { replace: true });
      });
    }
  }, [loading, rolesLoading, isAssociated, roles, rolesError, session, user, navigate, signOut]);

  if (loading || rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <Spinner />
      </div>
    );
  }

  if (session && user && isAssociated) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-xl">
          <CardHeader><CardTitle>Already signed in</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              You're signed in as <span className="font-medium text-foreground">{user.email ?? user.id}</span>.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => navigate(isTech ? "/tech" : isCustomer ? "/portal" : "/dashboard")}>
                Continue to {isTech ? "Technician App" : isCustomer ? "Customer Portal" : "Dashboard"}
              </Button>
              <Button type="button" variant="outline" onClick={() => void signOut().then(() => navigate("/login", { replace: true }))}>
                Sign out
              </Button>
              <Button type="button" variant="destructive" onClick={() => void hardReset()}>
                Hard reset
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AuthLayout
      title="Welcome back."
      subtitle={meta.subtitle}
      topRight={
        <Link to="/signup" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Need an account? <span className="text-primary">Sign up</span>
        </Link>
      }
      side={meta.side}
    >
      {reason === "unauthorized" ? (
        <div className="mb-4 rounded-md border border-border/60 bg-muted/30 px-4 py-3 text-sm">
          This account isn't linked to a technician, admin, owner, or staff seat yet. Ask your administrator to add you, then try again.
          {rolesError ? <div className="mt-2 text-xs text-muted-foreground">Role lookup error: {rolesError}</div> : null}
        </div>
      ) : null}

      <Tabs value={mode} onValueChange={(v) => setMode(v as LoginMode)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-muted/40">
          {(["company", "technician", "customer"] as const).map((m) => {
            const Icon = MODE_META[m].icon;
            return (
              <TabsTrigger key={m} value={m} className="gap-1.5 text-xs sm:text-sm">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{MODE_META[m].label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="company">
          <LoginForm
            heading="Company login"
            description="Access the admin dashboard to manage your business."
            showMagicLink={false}
            showCreateAccount
            callbackNext="/dashboard"
          />
        </TabsContent>

        <TabsContent value="technician">
          <LoginForm
            heading="Technician login"
            description="Sign in with the credentials from your invite email."
            showMagicLink={false}
            showCreateAccount={false}
            callbackNext="/tech"
          />
        </TabsContent>

        <TabsContent value="customer">
          <LoginForm
            heading="Customer login"
            description="Use the login link from your email, or enter your credentials."
            showMagicLink
            showCreateAccount={false}
            callbackNext="/portal"
          />
        </TabsContent>
      </Tabs>
    </AuthLayout>
  );
}
