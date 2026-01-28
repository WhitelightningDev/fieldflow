import { Button } from "@/components/ui/button";
import { Check, Minus } from "lucide-react";
import { useState } from "react";

const plans = [
  {
    name: "Starter",
    description: "For small teams getting started",
    basePrice: 29,
    technicianPrice: 15,
    features: [
      { name: "Company dashboard", included: true },
      { name: "Job scheduling", included: true },
      { name: "Customer management", included: true },
      { name: "Digital job cards", included: true },
      { name: "PDF exports", included: true },
      { name: "Basic reporting", included: true },
      { name: "Mobile app access", included: true },
      { name: "Email support", included: true },
      { name: "API access", included: false },
      { name: "AI features", included: false },
      { name: "Priority support", included: false },
    ],
    popular: false,
  },
  {
    name: "Pro",
    description: "For growing service companies",
    basePrice: 79,
    technicianPrice: 12,
    features: [
      { name: "Everything in Starter", included: true },
      { name: "Advanced reporting", included: true },
      { name: "Custom job templates", included: true },
      { name: "Integrations (Xero, Sage)", included: true },
      { name: "Payment links", included: true },
      { name: "Bulk scheduling", included: true },
      { name: "Priority email support", included: true },
      { name: "API access", included: true },
      { name: "AI job summaries", included: false },
      { name: "Dedicated account manager", included: false },
      { name: "Custom branding", included: false },
    ],
    popular: true,
  },
  {
    name: "Business",
    description: "For established operations",
    basePrice: 199,
    technicianPrice: 9,
    features: [
      { name: "Everything in Pro", included: true },
      { name: "AI job summaries", included: true },
      { name: "AI invoice suggestions", included: true },
      { name: "Custom branding", included: true },
      { name: "Webhook access", included: true },
      { name: "Unlimited document storage", included: true },
      { name: "Dedicated account manager", included: true },
      { name: "Phone support", included: true },
      { name: "SLA guarantee", included: true },
      { name: "Custom integrations", included: true },
      { name: "Training sessions", included: true },
    ],
    popular: false,
  },
];

const PricingSection = () => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [technicianCount, setTechnicianCount] = useState(3);

  const discount = billingCycle === "annual" ? 0.8 : 1;

  return (
    <section id="pricing" className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground text-lg">
            Base subscription + per-technician billing. Only pay for active seats.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center items-center gap-4 mb-8">
          <span className={billingCycle === "monthly" ? "font-medium" : "text-muted-foreground"}>
            Monthly
          </span>
          <button
            onClick={() => setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")}
            className="relative w-14 h-8 bg-primary rounded-none border-2 border-border"
          >
            <div
              className={`absolute top-1 w-5 h-5 bg-primary-foreground border border-border transition-all ${
                billingCycle === "annual" ? "left-7" : "left-1"
              }`}
            />
          </button>
          <span className={billingCycle === "annual" ? "font-medium" : "text-muted-foreground"}>
            Annual
            <span className="ml-1 text-xs bg-primary text-primary-foreground px-2 py-0.5">
              Save 20%
            </span>
          </span>
        </div>

        {/* Technician Slider */}
        <div className="max-w-md mx-auto mb-12 bg-secondary border-2 border-border p-6">
          <label className="block text-sm font-medium mb-3">
            How many technicians?
          </label>
          <input
            type="range"
            min="1"
            max="20"
            value={technicianCount}
            onChange={(e) => setTechnicianCount(Number(e.target.value))}
            className="w-full h-2 bg-accent appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-sm mt-2">
            <span>1</span>
            <span className="font-bold text-lg">{technicianCount} technicians</span>
            <span>20+</span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => {
            const baseMonthly = plan.basePrice * discount;
            const techMonthly = plan.technicianPrice * discount * technicianCount;
            const total = baseMonthly + techMonthly;

            return (
              <div
                key={plan.name}
                className={`relative bg-background border-2 border-border p-6 ${
                  plan.popular ? "shadow-md -translate-y-2" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 text-sm font-medium">
                    Most Popular
                  </div>
                )}

                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${Math.round(total)}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    ${Math.round(baseMonthly)} base + ${Math.round(plan.technicianPrice * discount)}/technician
                  </div>
                </div>

                <Button 
                  className="w-full mb-6" 
                  variant={plan.popular ? "default" : "outline"}
                >
                  Start Free Trial
                </Button>

                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature.name} className="flex items-center gap-2 text-sm">
                      {feature.included ? (
                        <Check className="h-4 w-4 text-foreground flex-shrink-0" />
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className={feature.included ? "" : "text-muted-foreground"}>
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          All prices in USD. Taxes may apply. Admin and office users are free—only technicians are billed.
        </p>
      </div>
    </section>
  );
};

export default PricingSection;
