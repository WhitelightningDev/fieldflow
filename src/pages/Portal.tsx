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
    `text-sm ${isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <RequireAuth allowedRoles={["customer"]}>
      <div className="min-h-[100dvh] bg-gradient-to-b from-background via-background to-muted/30">
        <header className="border-b border-border/60 bg-background/70 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
            <Link to="/portal" className="flex items-center gap-2">
              <BrandMark iconSize={28} />
              <div className="text-sm font-semibold">Quote Portal</div>
            </Link>

            <nav className="flex items-center gap-4">
              <NavLink to="/portal" end className={linkClass}>
                My quotes
              </NavLink>
              <NavLink to="/portal/settings" className={linkClass}>
                Settings
              </NavLink>
            </nav>

            <div className="flex items-center gap-2">
              <NotificationBell basePath="/portal" />
              <Button type="button" variant="outline" size="sm" onClick={() => void doSignOut()} disabled={signingOut}>
                {signingOut ? "Signing out..." : "Sign out"}
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8">
          <Outlet />
        </main>
      </div>
    </RequireAuth>
  );
}
