import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { withTimeout } from "@/lib/with-timeout";
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";

function parseHashParams() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(hash);
}

async function getRedirectPath(userId: string): Promise<string> {
  const fetchRoleSet = async () => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) throw error;
    return new Set((data ?? []).map((r) => r.role).filter(Boolean) as string[]);
  };

  // Check if user has a recognized role (best-effort repair if roles are missing)
  let roleSet = new Set<string>();
  try {
    roleSet = await fetchRoleSet();
    if (roleSet.size === 0) {
      const res: any = await (supabase.rpc as any)("ensure_user_role");
      if (res?.error) {
        // ignore; guard will treat as unauthorized
      }
      roleSet = await fetchRoleSet();
    }
  } catch {
    roleSet = new Set<string>();
  }

  const isAssociated =
    roleSet.has("owner") ||
    roleSet.has("admin") ||
    roleSet.has("office_staff") ||
    roleSet.has("technician");

  if (!isAssociated) return "/login?reason=unauthorized";

  const isTech = roleSet.has("technician");
  if (isTech) {
    // Mark technician access as accepted (best-effort)
    await supabase
      .from("technicians")
      .update({ invite_status: "accepted" } as any)
      .eq("user_id", userId);
    return "/tech";
  }

  return "/dashboard";
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url = new URL(window.location.href);
        const next = url.searchParams.get("next");
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
          const redirectPath = await getRedirectPath(data.session.user.id);
          if (redirectPath.startsWith("/login?reason=unauthorized")) {
            await signOut().catch(() => {});
            navigate(redirectPath, { replace: true });
            return;
          }
          if (next && redirectPath === "/tech" && next.startsWith("/tech")) {
            navigate(next, { replace: true });
            return;
          }
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
  }, [navigate, signOut]);

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
