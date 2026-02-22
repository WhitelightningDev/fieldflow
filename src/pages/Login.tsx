import AuthLayout from "@/features/auth/components/auth-layout";
import LoginForm from "@/features/auth/components/login-form";
import { useAuth } from "@/features/auth/hooks/use-auth";
import TradeBadges from "@/features/company-signup/components/trade-badges";
import { COMPANY_SIGNUP_FEATURES } from "@/features/company-signup/content/features";
import { CheckCircle2 } from "lucide-react";
import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const { session, user, loading, roles, rolesLoading, rolesError, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const reason = React.useMemo(() => {
    const qs = new URLSearchParams(location.search.startsWith("?") ? location.search.slice(1) : location.search);
    return qs.get("reason");
  }, [location.search]);

  const roleSet = React.useMemo(() => new Set(roles), [roles]);
  const isAssociated = React.useMemo(
    () =>
      roleSet.has("owner") ||
      roleSet.has("admin") ||
      roleSet.has("office_staff") ||
      roleSet.has("technician"),
    [roleSet],
  );
  const isTech = React.useMemo(() => roleSet.has("technician"), [roleSet]);

  const hardReset = React.useCallback(async () => {
    try {
      await signOut();
    } catch {
      // ignore
    }
    // Best-effort: clear PWA caches + unregister service workers so stale bundles don't linger.
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.allSettled(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // ignore
    }
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(regs.map((r) => r.unregister()));
      }
    } catch {
      // ignore
    }
    window.location.replace("/login");
  }, [signOut]);

  React.useEffect(() => {
    if (loading || rolesLoading || !session || !user) return;

    if (!isAssociated) {
      try {
        sessionStorage.setItem(
          "ff-auth-debug",
          JSON.stringify({
            at: new Date().toISOString(),
            userId: user.id,
            roles,
            rolesError: rolesError ?? null,
          }),
        );
      } catch {
        // ignore
      }
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

  // If a session exists, don't auto-redirect: show the user why clicking "Log in" appears to "auto log in".
  // This also gives a clear escape hatch to fully reset the client (PWA + auth).
  if (session && user && isAssociated) {
    const storageKeys = (() => {
      try {
        return Object.keys(localStorage).filter((k) => k.startsWith("sb-")).sort();
      } catch {
        return [];
      }
    })();

    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Already signed in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              You’re signed in as <span className="font-medium text-foreground">{user.email ?? user.id}</span>. Deleting company rows does not log you out of Supabase Auth.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => navigate(isTech ? "/tech" : "/dashboard")}>
                Continue
              </Button>
              <Button type="button" variant="outline" onClick={() => void signOut().then(() => navigate("/login", { replace: true }))}>
                Sign out
              </Button>
              <Button type="button" variant="destructive" onClick={() => void hardReset()}>
                Hard reset (auth + cache)
              </Button>
            </div>

            <details className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">Debug details</summary>
              <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                <div>Path: {location.pathname}{location.search}{location.hash}</div>
                <div>Roles: {roles.join(", ") || "—"}</div>
                <div>LocalStorage `sb-*` keys: {storageKeys.length ? storageKeys.join(", ") : "none"}</div>
                <div className="text-[11px]">
                  Tip: if this keeps returning after clearing storage, check for another open tab/PWA window still logged in (it can restore the session).
                </div>
              </div>
            </details>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AuthLayout
      title="Welcome back."
      subtitle="Log in to manage jobs, techs, and billing."
      topRight={
        <Link to="/signup" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Need an account? <span className="text-primary">Sign up</span>
        </Link>
      }
      side={
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
      }
    >
      {reason === "unauthorized" ? (
        <div className="mb-4 rounded-md border border-border/60 bg-muted/30 px-4 py-3 text-sm">
          This account isn’t linked to a technician, admin, owner, or staff seat yet. Ask your administrator to add you, then try again.
          {rolesError ? (
            <div className="mt-2 text-xs text-muted-foreground">
              Role lookup error: {rolesError}
            </div>
          ) : null}
          <DebugDetails />
        </div>
      ) : null}
      <LoginForm />
    </AuthLayout>
  );
}

function DebugDetails() {
  const [value, setValue] = React.useState<string>("");

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem("ff-auth-debug") ?? "";
      setValue(raw);
    } catch {
      setValue("");
    }
  }, []);

  if (!value) return null;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-muted-foreground">Debug details</summary>
      <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-muted-foreground">{value}</pre>
    </details>
  );
}
