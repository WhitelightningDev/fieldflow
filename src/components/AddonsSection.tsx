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
  },
  {
    icon: Receipt,
    name: "AI Invoice Suggestions",
    description: "Smart pricing recommendations based on job complexity and history.",
    pricing: "$29/mo per company",
  },
  {
    icon: Link2,
    name: "Accounting Integrations",
    description: "Connect to Sage, Xero, QuickBooks and more for seamless sync.",
    pricing: "$15/mo per company",
  },
  {
    icon: CreditCard,
    name: "Payment Links",
    description: "Send payment links via SMS or email. Accept cards instantly.",
    pricing: "2.9% + $0.30 per transaction",
  },
  {
    icon: HardDrive,
    name: "Extra Storage",
    description: "Additional document and photo storage beyond your plan limit.",
    pricing: "$5/mo per 10GB",
  },
  {
    icon: Webhook,
    name: "API & Webhooks",
    description: "Full API access for custom integrations and automations.",
    pricing: "$49/mo per company",
  },
];

const AddonsSection = () => {
  return (
    <section id="addons" className="py-16 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Powerful add-ons
          </h2>
          <p className="text-muted-foreground text-lg">
            Extend your platform with optional features. Enable only what you need.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {addons.map((addon) => (
            <div
              key={addon.name}
              className="bg-background border-2 border-border p-6 flex flex-col"
            >
              <div className="w-10 h-10 bg-accent flex items-center justify-center mb-4">
                <addon.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">{addon.name}</h3>
              <p className="text-sm text-muted-foreground mb-4 flex-grow">
                {addon.description}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <span className="text-sm font-medium">{addon.pricing}</span>
                <Button variant="outline" size="sm">
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
