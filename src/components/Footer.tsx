import { BrandIcon, BrandWordmark } from "@/components/brand/brand-mark";
import { Link } from "react-router-dom";

const Footer = () => {
  const productLinks = [
    { label: "Features", to: "/#features" },
    { label: "Roles", to: "/#roles" },
    { label: "Pricing", to: "/#pricing" },
    { label: "Add-ons", to: "/#addons" },
  ];

  const getStartedLinks = [
    { label: "Start Free Trial", to: "/plan-wizard" },
    { label: "Log in", to: "/login" },
    { label: "Contact", to: "/contact" },
  ];

  return (
    <footer className="border-t border-border/50 py-12 bg-card/30">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <BrandIcon size={36} />
              <BrandWordmark className="text-lg" />
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              Field service management built for modern teams. Dispatch, track, invoice — all in one place.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">Product</h4>
            <ul className="space-y-2.5">
              {productLinks.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">Get started</h4>
            <ul className="space-y-2.5">
              {getStartedLinks.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border/50 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} FieldFlow. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
