import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/notification-bell";
import { RequireAuth, useAuth } from "@/features/auth/hooks/use-auth";
import * as React from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

export default function Portal() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = React.useState(false);

  const doSignOut = async () => {
    try {
      setSigningOut(true);
      await signOut();
    } finally {
      setSigningOut(false);
      navigate("/login", { replace: true });
    }
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm px-3 py-1.5 rounded-xl transition-colors duration-200 ${
      isActive
        ? "bg-primary/10 text-primary font-medium"
        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
    }`;

  return (
    <RequireAuth allowedRoles={["customer"]}>
      <div className="min-h-[100dvh] bg-gradient-to-b from-background via-background to-muted/30">
        {/* M3 top app bar */}
        <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-lg shadow-sm pt-[max(env(safe-area-inset-top),0.25rem)]">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
            <Link to="/portal" className="flex items-center gap-2.5">
              <BrandMark iconSize={28} />
              <span className="text-sm font-semibold tracking-tight">Quote Portal</span>
            </Link>

            <nav className="flex items-center gap-1">
              <NavLink to="/portal" end className={linkClass}>
                My quotes
              </NavLink>
              <NavLink to="/portal/settings" className={linkClass}>
                Settings
              </NavLink>
            </nav>

            <div className="flex items-center gap-2">
              <NotificationBell basePath="/portal" />
              <Button type="button" variant="tonal" size="sm" onClick={() => void doSignOut()} disabled={signingOut}>
                {signingOut ? "Signing out…" : "Sign out"}
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-5 sm:py-8">
          <Outlet />
        </main>
      </div>
    </RequireAuth>
  );
}
