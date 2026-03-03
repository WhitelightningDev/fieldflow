import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/notification-bell";
import { RequireAuth, useAuth } from "@/features/auth/hooks/use-auth";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import * as React from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";

export default function Portal() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [signingOut, setSigningOut] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Close menu on navigation
  React.useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

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
    `text-sm px-3 py-2 rounded-xl transition-colors duration-200 block ${
      isActive
        ? "bg-primary/10 text-primary font-medium"
        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
    }`;

  return (
    <RequireAuth allowedRoles={["customer"]}>
      <div className="min-h-[100dvh] bg-gradient-to-b from-background via-background to-muted/30">
        {/* M3 top app bar */}
        <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-lg shadow-sm pt-[max(env(safe-area-inset-top),0.25rem)]">
          <div className="mx-auto max-w-5xl px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-3">
            {/* Mobile burger */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Link to="/portal" className="flex items-center gap-2.5">
              <BrandMark iconSize={28} />
              <span className="text-sm font-semibold tracking-tight hidden sm:inline">Quote Portal</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-1">
              <NavLink to="/portal" end className={linkClass}>
                My quotes
              </NavLink>
              <NavLink to="/portal/settings" className={linkClass}>
                Settings
              </NavLink>
            </nav>

            <div className="flex items-center gap-2">
              <NotificationBell basePath="/portal" />
              <Button type="button" variant="tonal" size="sm" className="hidden sm:inline-flex" onClick={() => void doSignOut()} disabled={signingOut}>
                {signingOut ? "Signing out…" : "Sign out"}
              </Button>
            </div>
          </div>
        </header>

        {/* Mobile drawer menu */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="p-0 w-[85vw] max-w-72">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <div className="flex flex-col h-full pt-[max(env(safe-area-inset-top),0.5rem)] pb-[max(env(safe-area-inset-bottom),0.5rem)]">
              <div className="p-4 border-b border-border">
                <Link to="/portal" className="flex items-center gap-2.5">
                  <BrandMark iconSize={28} />
                  <span className="text-sm font-semibold tracking-tight">Quote Portal</span>
                </Link>
              </div>
              <nav className="flex-1 p-3 space-y-1">
                <NavLink to="/portal" end className={linkClass}>
                  My quotes
                </NavLink>
                <NavLink to="/portal/settings" className={linkClass}>
                  Settings
                </NavLink>
              </nav>
              <div className="p-3 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => void doSignOut()}
                  disabled={signingOut}
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <main className="mx-auto max-w-5xl px-4 py-5 sm:py-8">
          <Outlet />
        </main>
      </div>
    </RequireAuth>
  );
}
