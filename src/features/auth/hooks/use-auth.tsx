import { supabase } from "@/integrations/supabase/client";
import { clearSupabaseAuthStorage } from "@/integrations/supabase/clear-auth";
import type { Session, User } from "@supabase/supabase-js";
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { withTimeout } from "@/lib/with-timeout";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: { id: string; full_name: string; email: string | null; company_id: string | null } | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<AuthContextValue["profile"]>(null);
  const [loading, setLoading] = React.useState(true);

  const bootstrapAttemptedRef = React.useRef(new Set<string>());

  const bootstrapCompanyClientSide = React.useCallback(async (userId: string) => {
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) return false;
    const meta: any = userRes.user?.user_metadata ?? {};

    const companyName = (meta.company_name ?? "").toString().trim();
    if (!companyName) return false;

    const industry = (meta.industry ?? "general").toString();
    const teamSize = meta.team_size ? meta.team_size.toString() : null;
    const fullName = meta.full_name ? meta.full_name.toString() : "";
    const email = userRes.user?.email ?? null;

    // Ensure profile exists (some projects may not have the auth trigger installed).
    await supabase
      .from("profiles")
      .upsert(
        { user_id: userId, full_name: fullName, email },
        { onConflict: "user_id" },
      );

    // Create company and link profile.
    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .insert({ name: companyName, industry, team_size: teamSize })
      .select("id")
      .single();
    if (companyErr || !company?.id) return false;

    const { error: linkErr } = await supabase
      .from("profiles")
      .update({ company_id: company.id })
      .eq("user_id", userId);
    if (linkErr) return false;

    // Best-effort: assign owner role (if policy exists).
    await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "owner" } as any);

    return true;
  }, []);

  const fetchProfile = React.useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, company_id")
      .eq("user_id", userId)
      .maybeSingle();

    const shouldBootstrap = !bootstrapAttemptedRef.current.has(userId) && (!data || !data.company_id);
    if (shouldBootstrap) {
      bootstrapAttemptedRef.current.add(userId);
      const { data: companyId, error } = await supabase.rpc("bootstrap_company_from_user_metadata" as any);
      if (!error && companyId) {
        const { data: updated } = await supabase
          .from("profiles")
          .select("id, full_name, email, company_id")
          .eq("user_id", userId)
          .maybeSingle();
        setProfile(updated);
        return;
      }
      // Fallback if the RPC doesn't exist yet or failed: bootstrap from user_metadata client-side.
      const clientBootstrapped = await bootstrapCompanyClientSide(userId);
      if (clientBootstrapped) {
        const { data: updated } = await supabase
          .from("profiles")
          .select("id, full_name, email, company_id")
          .eq("user_id", userId)
          .maybeSingle();
        setProfile(updated);
        return;
      }
    }

    setProfile(data);
  }, [bootstrapCompanyClientSide]);

  React.useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        try {
          setSession(newSession);
          if (newSession?.user) {
            await fetchProfile(newSession.user.id);
          } else {
            setProfile(null);
          }
        } catch (e) {
          console.error("Auth state change error", e);
        } finally {
          setLoading(false);
        }
      }
    );

    withTimeout(supabase.auth.getSession(), 8000, "Initial session check timed out.")
      .then(({ data: { session: s } }) => {
        setSession(s);
        if (s?.user) {
          fetchProfile(s.user.id).then(() => setLoading(false)).catch(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch((e) => {
        console.error("getSession error", e);
        clearSupabaseAuthStorage();
        setSession(null);
        setProfile(null);
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = React.useCallback(async () => {
    try {
      // Try to revoke server-side refresh token, but never block UI on it.
      try {
        await withTimeout(supabase.auth.signOut(), 8000, "Remote sign out timed out.");
      } catch {}
      try {
        await withTimeout(supabase.auth.signOut({ scope: "local" }), 8000, "Local sign out timed out.");
      } catch {}
      clearSupabaseAuthStorage();
      // If the URL still contains auth hash params, clear them to prevent auto re-auth.
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    } finally {
      setSession(null);
      setProfile(null);
      setLoading(false);
    }
  }, []);

  const refreshProfile = React.useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return;
    await fetchProfile(userId);
  }, [fetchProfile]);

  const value = React.useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, profile, loading, signOut, refreshProfile }),
    [session, profile, loading, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!loading && !session) {
      navigate("/login", { replace: true });
    }
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) return null;
  return <>{children}</>;
}
