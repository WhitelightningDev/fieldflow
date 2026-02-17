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
  profileLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<AuthContextValue["profile"]>(null);
  const [loading, setLoading] = React.useState(true);
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [resumeChecking, setResumeChecking] = React.useState(false);

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

    await supabase
      .from("profiles")
      .upsert(
        { user_id: userId, full_name: fullName, email },
        { onConflict: "user_id" },
      );

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
    let isMounted = true;

    // Listener for ONGOING auth changes — does NOT control isLoading.
    // CRITICAL: Do NOT await Supabase calls directly inside this callback
    // to avoid deadlocks during token refresh.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!isMounted) return;
        setSession(newSession);

        if (newSession?.user) {
          // Dispatch after callback completes to avoid deadlock
          setProfileLoading(true);
          setTimeout(() => {
            if (isMounted) {
              fetchProfile(newSession.user.id)
                .catch(console.error)
                .finally(() => {
                  if (isMounted) setProfileLoading(false);
                });
            }
          }, 0);
        } else {
          setProfile(null);
          setProfileLoading(false);
        }
      }
    );

    // INITIAL load — controls isLoading
    const initializeAuth = async () => {
      try {
        const { data: { session: s } } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          "Initial session check timed out.",
        );
        if (!isMounted) return;

        setSession(s);
        if (s?.user) {
          setProfileLoading(true);
          await fetchProfile(s.user.id);
          if (isMounted) setProfileLoading(false);
        }
      } catch (e) {
        console.error("getSession error", e);
        if (!isMounted) return;
        clearSupabaseAuthStorage();
        setSession(null);
        setProfile(null);
        setProfileLoading(false);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // iOS PWAs can suspend the page; on resume, re-check the session to avoid a brief "logged out" flash.
  React.useEffect(() => {
    let cancelled = false;
    const onResume = () => {
      try {
        if (document.visibilityState !== "visible") return;
      } catch {
        // ignore
      }
      if (loading) return;
      if (session) return;

      setResumeChecking(true);
      void withTimeout(supabase.auth.getSession(), 4000, "Resume session check timed out.")
        .then(({ data }) => {
          if (cancelled) return;
          if (data?.session) {
            setSession(data.session);
            if (data.session.user) {
              setProfileLoading(true);
              void fetchProfile(data.session.user.id)
                .catch(() => {
                  // ignore
                })
                .finally(() => {
                  if (!cancelled) setProfileLoading(false);
                });
            }
          }
        })
        .catch(() => {
          // ignore
        })
        .finally(() => {
          if (!cancelled) setResumeChecking(false);
        });
    };

    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume as any);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume as any);
    };
  }, [fetchProfile, loading, session]);

  const signOut = React.useCallback(async () => {
    try {
      try {
        await withTimeout(supabase.auth.signOut(), 8000, "Remote sign out timed out.");
      } catch {}
      try {
        await withTimeout(supabase.auth.signOut({ scope: "local" }), 8000, "Local sign out timed out.");
      } catch {}
      clearSupabaseAuthStorage();
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    } finally {
      setSession(null);
      setProfile(null);
      setLoading(false);
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = React.useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return;
    await fetchProfile(userId);
  }, [fetchProfile]);

  const value = React.useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, profile, loading: loading || resumeChecking, profileLoading, signOut, refreshProfile }),
    [session, profile, loading, profileLoading, resumeChecking, signOut, refreshProfile]
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
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (loading) {
      setPending(false);
      return;
    }
    if (session) {
      setPending(false);
      return;
    }

    // Avoid a brief redirect flicker on iOS PWA resume while the session is being restored.
    setPending(true);
    const id = window.setTimeout(() => {
      setPending(false);
      navigate("/login", { replace: true });
    }, 1200);
    return () => window.clearTimeout(id);
  }, [loading, session, navigate]);

  if (loading || pending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) return null;
  return <>{children}</>;
}
