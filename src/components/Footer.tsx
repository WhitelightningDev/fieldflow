import Logo from "@/assets/fieldflow-logo-removebg-preview.png";

const Footer = () => {
  const links = {
    Product: ["Features", "Pricing", "Add-ons", "Mobile App", "Integrations"],
    Company: ["About", "Blog", "Careers", "Contact"],
    Resources: ["Help Center", "API Docs", "Status", "Security"],
    Legal: ["Privacy", "Terms", "Cookie Policy"],
  };

  return (
    <footer className="border-t border-border/50 py-12 bg-card/50">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center">
                <img src={Logo} className="text-primary-foreground font-bold text-lg" alt="" />
              </div>
              <span className="font-bold text-xl">
                Field<span className="gradient-text">Flow</span>
              </span>
            </a>
            <p className="text-sm text-muted-foreground">
              Field service management for modern teams.
            </p>
          </div>

          {/* Link Columns */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="font-semibold mb-4">{category}</h4>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2024 FieldFlow. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Twitter
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              LinkedIn
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              YouTube
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
