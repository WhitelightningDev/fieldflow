import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { BrandIcon, BrandWordmark } from "@/components/brand/brand-mark";

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#addons" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Add-ons
            </a>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild size="sm" className="gradient-bg hover:opacity-90 transition-opacity shadow-glow">
              <Link to="/company-signup">Start Free Trial</Link>
            </Button>
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
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                Features
              </a>
              <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                Pricing
              </a>
              <a href="#addons" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                Add-ons
              </a>
              <div className="flex flex-col gap-2 pt-4 border-t border-border/50">
                <Button asChild variant="ghost" className="w-full justify-start">
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild className="w-full gradient-bg">
                  <Link to="/company-signup">Start Free Trial</Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
