import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/with-timeout";
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";

function parseHashParams() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(hash);
}

async function getRedirectPath(userId: string): Promise<string> {
  // Check if user has technician role
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const isTech = roles?.some((r) => r.role === "technician");
  if (isTech) return "/tech";

  // Mark technician invite as accepted if applicable
  await supabase
    .from("technicians")
    .update({ invite_status: "accepted" } as any)
    .eq("user_id", userId);

  return "/dashboard";
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        const hashParams = parseHashParams();
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const hashError = hashParams.get("error_description") || hashParams.get("error");
        const queryError = url.searchParams.get("error_description") || url.searchParams.get("error");

        if (hashError || queryError) {
          throw new Error(hashError || queryError || "Authentication error.");
        }

        if (code) {
          const { error: exchangeError } = await withTimeout(supabase.auth.exchangeCodeForSession(code), 15000, "Auth exchange timed out.");
          if (exchangeError) throw exchangeError;
        } else if (tokenHash && type) {
          const { error: verifyError } = await withTimeout(supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          }), 15000, "OTP verification timed out.");
          if (verifyError) throw verifyError;
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await withTimeout(supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }), 15000, "Session setup timed out.");
          if (sessionError) throw sessionError;
        }

        const { data } = await withTimeout(supabase.auth.getSession(), 15000, "Session check timed out.");
        if (cancelled) return;

        if (data.session) {
          // Best-effort: ensure company exists if signup metadata included it.
          await withTimeout(
            (supabase.rpc as any)("bootstrap_company_from_user_metadata").then(() => {}),
            15000,
            "Company bootstrap timed out.",
          ).catch(() => {});

          const redirectPath = await getRedirectPath(data.session.user.id);
          navigate(redirectPath, { replace: true });
        } else {
          navigate("/login", { replace: true });
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Authentication callback failed.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <div className="text-2xl font-bold">Finishing sign-in…</div>
        <div className="text-sm text-muted-foreground">
          You can close this tab once you're redirected.
        </div>

        {error ? (
          <div className="rounded-md border p-4 text-left">
            <div className="font-medium">Something went wrong</div>
            <div className="text-sm text-muted-foreground mt-1">{error}</div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/login">Go to login</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
