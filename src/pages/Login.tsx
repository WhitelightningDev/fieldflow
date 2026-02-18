import AuthLayout from "@/features/auth/components/auth-layout";
import LoginForm from "@/features/auth/components/login-form";
import { useAuth } from "@/features/auth/hooks/use-auth";
import TradeBadges from "@/features/company-signup/components/trade-badges";
import { COMPANY_SIGNUP_FEATURES } from "@/features/company-signup/content/features";
import { CheckCircle2 } from "lucide-react";
import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

export default function Login() {
  const { session, user, loading, roles, rolesLoading, rolesError, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const reason = React.useMemo(() => {
    const qs = new URLSearchParams(location.search.startsWith("?") ? location.search.slice(1) : location.search);
    return qs.get("reason");
  }, [location.search]);

  React.useEffect(() => {
    if (loading || rolesLoading || !session || !user) return;

    const roleSet = new Set(roles);
    const isAssociated =
      roleSet.has("owner") ||
      roleSet.has("admin") ||
      roleSet.has("office_staff") ||
      roleSet.has("technician");

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
      return;
    }

    const isTech = roleSet.has("technician");
    navigate(isTech ? "/tech" : "/dashboard", { replace: true });
  }, [loading, rolesLoading, roles, session, user, navigate, signOut]);

  if (loading || rolesLoading || session) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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
