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
    <footer className="border-t border-border/50 py-12 bg-card/50">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <BrandIcon size={40} />
              <BrandWordmark className="text-xl" />
            </Link>
            <p className="text-sm text-muted-foreground">
              Field service management for modern teams.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2">
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
            <h4 className="font-semibold mb-4">Get started</h4>
            <ul className="space-y-2">
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

        <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2024 FieldFlow. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
