import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Zap, Shield, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useActiveCompanyCount } from "@/hooks/use-active-company-count";

const stats = [
  { value: "99.9%", label: "Uptime" },
  { value: "< 2min", label: "Setup Time" },
  { value: "4.9/5", label: "Rating" },
];

const HeroSection = () => {
  const { count } = useActiveCompanyCount();

  return (
    <section className="pt-28 pb-20 md:pt-36 md:pb-28 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(199_89%_48%/0.08),transparent_60%)]" />
      <div className="absolute top-40 -right-20 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 border border-primary/20 px-4 py-1.5 mb-8 text-sm font-medium bg-primary/5 rounded-full animate-fade-in">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-primary">AI-Powered Field Service Management</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-6 animate-fade-in-up opacity-0 stagger-1">
            Dispatch smarter.
            <br />
            <span className="gradient-text">Bill faster.</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto animate-fade-in-up opacity-0 stagger-2">
            Schedule jobs, manage technicians, track inventory, and get paid — all from one platform.
            Built for service companies that move fast.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10 animate-fade-in-up opacity-0 stagger-3">
            <Button asChild size="lg" className="gradient-bg hover:opacity-90 shadow-glow transition-all text-base px-8">
              <Link to="/plan-wizard">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-border/50 hover:bg-secondary/50 backdrop-blur-sm text-base px-8">
              <Link to="/contact?subject=Demo%20request">Book a Demo</Link>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-6 animate-fade-in-up opacity-0 stagger-4">
            {["14-day free trial", "No credit card required", "Cancel anytime"].map((benefit) => (
              <div key={benefit} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto animate-fade-in-up opacity-0 stagger-5">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center py-4 px-3 rounded-xl bg-card/60 backdrop-blur-sm border border-border/30">
              <div className="text-2xl font-bold font-mono gradient-text">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
          <div className="text-center py-4 px-3 rounded-xl bg-card/60 backdrop-blur-sm border border-border/30">
            <div className="text-2xl font-bold font-mono gradient-text">
              {count == null ? "…" : `${count}+`}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Companies</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
