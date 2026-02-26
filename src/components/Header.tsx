import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { BrandIcon, BrandWordmark } from "@/components/brand/brand-mark";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  const first = parts[0]?.[0] ?? "U";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

function homePathForRoles(roles: string[]) {
  if (roles.includes("owner") || roles.includes("admin") || roles.includes("office_staff")) return "/dashboard";
  if (roles.includes("technician")) return "/tech";
  return "/dashboard";
}

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const { user, profile, roles, loading } = useAuth();

  const isAuthed = !loading && Boolean(user);
  const homePath = homePathForRoles(roles as any);
  const displayName = (profile?.full_name ?? user?.email ?? "Account").toString();
  const initials = initialsFromName(displayName);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <BrandIcon size={40} className="transition-all duration-300 group-hover:shadow-lg" />
            <BrandWordmark className="text-xl" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link to="/#roles" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Roles
            </Link>
            <Link to="/#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link to="/#addons" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Add-ons
            </Link>
            <Link to="/contact" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </Link>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthed ? (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground gap-2"
              >
                <Link to={homePath}>
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="max-w-[180px] truncate">{displayName}</span>
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild size="sm" className="gradient-bg hover:opacity-90 transition-opacity shadow-glow">
                  <Link to="/plan-wizard">Start Free Trial</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/50 py-4 animate-fade-in">
            <nav className="flex flex-col gap-4">
              <Link to="/#features" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={closeMobileMenu}>
                Features
              </Link>
              <Link to="/#roles" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={closeMobileMenu}>
                Roles
              </Link>
              <Link to="/#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={closeMobileMenu}>
                Pricing
              </Link>
              <Link to="/#addons" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={closeMobileMenu}>
                Add-ons
              </Link>
              <Link to="/contact" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={closeMobileMenu}>
                Contact
              </Link>
              <div className="flex flex-col gap-2 pt-4 border-t border-border/50">
                {isAuthed ? (
                  <Button asChild variant="ghost" className="w-full justify-start gap-2">
                    <Link to={homePath} onClick={closeMobileMenu}>
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{displayName}</span>
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="ghost" className="w-full justify-start">
                      <Link to="/login" onClick={closeMobileMenu}>Log in</Link>
                    </Button>
                    <Button asChild className="w-full gradient-bg">
                      <Link to="/plan-wizard" onClick={closeMobileMenu}>Start Free Trial</Link>
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
