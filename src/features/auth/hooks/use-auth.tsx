import { supabase } from "@/integrations/supabase/client";
import { clearSupabaseAuthStorage } from "@/integrations/supabase/clear-auth";
import type { Database } from "@/integrations/supabase/types";
import type { Session, User } from "@supabase/supabase-js";
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { withTimeout } from "@/lib/with-timeout";

type AppRole = Database["public"]["Enums"]["app_role"];

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: { id: string; full_name: string; email: string | null; company_id: string | null } | null;
  roles: AppRole[];
  profileError: string | null;
  rolesError: string | null;
  loading: boolean;
  profileLoading: boolean;
  rolesLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<AuthContextValue["profile"]>(null);
  const [roles, setRoles] = React.useState<AppRole[]>([]);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [rolesError, setRolesError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [rolesLoading, setRolesLoading] = React.useState(false);
  const [resumeChecking, setResumeChecking] = React.useState(false);

  const fetchProfile = React.useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, company_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      setProfile(null);
      setProfileError(error.message ?? "Failed to fetch profile");
      throw error;
    }
    setProfileError(null);
    setProfile(data ?? null);
    return data ?? null;
  }, []);

  const fetchRoles = React.useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) {
      setRoles([]);
      setRolesError(error.message ?? "Failed to fetch roles");
      throw error;
    }
    setRolesError(null);
    const next = (Array.isArray(data) ? data : [])
      .map((r) => r.role)
      .filter((r): r is AppRole => Boolean(r));
    setRoles(next);
    return next;
  }, []);

  const ensureRoles = React.useCallback(async (userId: string) => {
    let current: AppRole[] = [];
    try {
      current = await fetchRoles(userId);
    } catch {
      // If role reads are broken, we can't safely proceed.
      return [];
    }

    if (current.length > 0) return current;

    // Best-effort repair (DB function should only grant roles when user is legitimately associated).
    try {
      const res: any = await withTimeout(
        supabase.rpc("ensure_user_role" as any),
        8000,
        "Role repair timed out.",
      );
      const rpcErr = res?.error;
      if (rpcErr) {
        const msg = String(rpcErr.message ?? rpcErr);
        // Common symptom: migrations not applied yet (function missing from schema cache).
        if (msg.toLowerCase().includes("could not find the function")) {
          setRolesError('Database is missing the "ensure_user_role" RPC (apply Supabase migrations).');
        } else {
          setRolesError(`Role repair RPC error: ${msg}`);
        }
        return [];
      }
    } catch {
      // ignore
    }

    try {
      return await fetchRoles(userId);
    } catch {
      return [];
    }
  }, [fetchRoles]);

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
          setRolesLoading(true);
          setTimeout(() => {
            if (isMounted) {
              Promise.all([
                fetchProfile(newSession.user.id),
                ensureRoles(newSession.user.id),
              ])
                .catch(console.error)
                .finally(() => {
                  if (isMounted) {
                    setProfileLoading(false);
                    setRolesLoading(false);
                  }
                });
            }
          }, 0);
        } else {
          setProfile(null);
          setProfileLoading(false);
          setRoles([]);
          setRolesLoading(false);
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
          setRolesLoading(true);
          await Promise.all([
            fetchProfile(s.user.id),
            ensureRoles(s.user.id),
          ]);
          if (isMounted) setProfileLoading(false);
          if (isMounted) setRolesLoading(false);
        }
      } catch (e) {
        console.error("getSession error", e);
        if (!isMounted) return;
        clearSupabaseAuthStorage();
        setSession(null);
        setProfile(null);
        setProfileLoading(false);
        setRoles([]);
        setRolesLoading(false);
        setProfileError(null);
        setRolesError(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchRoles]);

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
              setRolesLoading(true);
              void Promise.all([
                fetchProfile(data.session.user.id),
                ensureRoles(data.session.user.id),
              ]).catch(() => {
                // ignore
              })
                .finally(() => {
                  if (!cancelled) {
                    setProfileLoading(false);
                    setRolesLoading(false);
                  }
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
  }, [fetchProfile, ensureRoles, loading, session]);

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
      setRoles([]);
      setProfileError(null);
      setRolesError(null);
      setLoading(false);
      setProfileLoading(false);
      setRolesLoading(false);
    }
  }, []);

  const refreshProfile = React.useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return;
    setProfileLoading(true);
    setRolesLoading(true);
    try {
      await Promise.all([
        fetchProfile(userId),
        ensureRoles(userId),
      ]);
    } finally {
      setProfileLoading(false);
      setRolesLoading(false);
    }
  }, [fetchProfile, ensureRoles]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      roles,
      profileError,
      rolesError,
      loading: loading || resumeChecking,
      profileLoading,
      rolesLoading,
      signOut,
      refreshProfile,
    }),
    [session, profile, roles, profileError, rolesError, loading, profileLoading, rolesLoading, resumeChecking, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function RequireAuth({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}) {
  const { session, loading, roles, rolesLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = React.useState(false);
  const [lockingDown, setLockingDown] = React.useState(false);

  const hasRequiredRole = React.useMemo(() => {
    if (!session) return false;
    if (allowedRoles && allowedRoles.length > 0) {
      return roles.some((r) => allowedRoles.includes(r));
    }
    return roles.length > 0;
  }, [allowedRoles, roles, session]);

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

  React.useEffect(() => {
    if (loading || rolesLoading) return;
    if (!session) return;
    if (hasRequiredRole) return;

    setLockingDown(true);
    void signOut()
      .catch(() => {})
      .finally(() => {
        navigate("/login?reason=unauthorized", { replace: true });
      });
  }, [hasRequiredRole, loading, rolesLoading, navigate, session, signOut]);

  if (loading || rolesLoading || pending || lockingDown) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) return null;
  if (!hasRequiredRole) return null;
  return <>{children}</>;
}
