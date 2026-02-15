import AuthLayout from "@/features/auth/components/auth-layout";
import LoginForm from "@/features/auth/components/login-form";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import TradeBadges from "@/features/company-signup/components/trade-badges";
import { COMPANY_SIGNUP_FEATURES } from "@/features/company-signup/content/features";
import { CheckCircle2 } from "lucide-react";
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const { session, user, loading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (loading || !session || !user) return;

    // Route based on role
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data: roles }) => {
        const isTech = roles?.some((r) => r.role === "technician");
        navigate(isTech ? "/tech" : "/dashboard", { replace: true });
      });
  }, [loading, session, user, navigate]);

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
      <LoginForm />
    </AuthLayout>
  );
}
