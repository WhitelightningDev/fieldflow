import { 
  Sparkles, 
  Receipt, 
  Link2, 
  HardDrive, 
  Webhook, 
  CreditCard 
} from "lucide-react";
import { Button } from "@/components/ui/button";

const addons = [
  {
    icon: Sparkles,
    name: "AI Job Summaries",
    description: "Auto-generate professional job summaries from technician notes.",
    pricing: "$19/mo per company",
    gradient: true,
  },
  {
    icon: Receipt,
    name: "AI Invoice Suggestions",
    description: "Smart pricing recommendations based on job complexity and history.",
    pricing: "$29/mo per company",
    gradient: true,
  },
  {
    icon: Link2,
    name: "Accounting Integrations",
    description: "Connect to Sage, Xero, QuickBooks and more for seamless sync.",
    pricing: "$15/mo per company",
    gradient: false,
  },
  {
    icon: CreditCard,
    name: "Payment Links",
    description: "Send payment links via SMS or email. Accept cards instantly.",
    pricing: "2.9% + $0.30 per transaction",
    gradient: false,
  },
  {
    icon: HardDrive,
    name: "Extra Storage",
    description: "Additional document and photo storage beyond your plan limit.",
    pricing: "$5/mo per 10GB",
    gradient: false,
  },
  {
    icon: Webhook,
    name: "API & Webhooks",
    description: "Full API access for custom integrations and automations.",
    pricing: "$49/mo per company",
    gradient: false,
  },
];

const AddonsSection = () => {
  return (
    <section id="addons" className="py-16 md:py-24 relative">
      <div className="absolute inset-0 bg-secondary/50" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(262_83%_58%/0.08),transparent_50%)]" />
      
      <div className="container mx-auto px-4 relative">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 border border-accent/30 px-4 py-1.5 mb-4 text-sm font-medium bg-accent/5 rounded-full">
            <span className="text-accent">Optional Add-ons</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Powerful <span className="gradient-text">extensions</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Extend your platform with optional features. Enable only what you need.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {addons.map((addon, index) => (
            <div
              key={addon.name}
              className={`group bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 flex flex-col hover-lift ${
                addon.gradient ? "gradient-border" : ""
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-shadow ${
                addon.gradient 
                  ? "gradient-bg group-hover:shadow-glow" 
                  : "bg-secondary group-hover:bg-accent"
              }`}>
                <addon.icon className={`h-5 w-5 ${addon.gradient ? "text-primary-foreground" : ""}`} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{addon.name}</h3>
              <p className="text-sm text-muted-foreground mb-4 flex-grow">
                {addon.description}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <span className="text-sm font-mono text-muted-foreground">{addon.pricing}</span>
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                  Learn More
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AddonsSection;
