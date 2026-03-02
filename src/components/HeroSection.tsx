import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";
import { Link } from "react-router-dom";
import { useActiveCompanyCount } from "@/hooks/use-active-company-count";

const HeroSection = () => {
  const { count } = useActiveCompanyCount();
  const benefits = [
    "14-day free trial",
    "No credit card required",
    "Cancel anytime",
  ];

  return (
    <section className="pt-24 pb-16 md:pt-32 md:pb-24 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(199_89%_48%/0.1),transparent_50%)]" />
      <div className="absolute top-20 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 border border-primary/30 px-4 py-1.5 mb-6 text-sm font-medium bg-primary/5 rounded-full animate-fade-in">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-primary">AI-Powered Field Service</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 animate-fade-in-up opacity-0 stagger-1">
              Dispatch smarter.
              <br />
              <span className="gradient-text">Bill faster.</span>
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed animate-fade-in-up opacity-0 stagger-2">
              The all-in-one platform for field service companies. Schedule jobs, 
              manage technicians, and get paid—all from one dashboard. 
              Pay only for active technicians.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8 animate-fade-in-up opacity-0 stagger-3">
              <Button asChild size="lg" className="gradient-bg hover:opacity-90 shadow-glow hover:shadow-lg transition-all">
                <Link to="/plan-wizard">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-border/50 hover:bg-secondary/50 backdrop-blur-sm">
                <Link to="/#pricing">View pricing</Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-4 animate-fade-in-up opacity-0 stagger-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Image */}
          <div className="relative animate-fade-in-up opacity-0 stagger-3">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/50">
              <img
                src={heroImage}
                alt="FieldFlow Dashboard"
                className="w-full h-auto"
              />
              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent pointer-events-none" />
            </div>
            
            {/* Floating Stats Card */}
            <div className="absolute -bottom-6 -left-6 bg-card/90 backdrop-blur-xl border border-border/50 shadow-xl rounded-xl p-4 hidden md:block animate-float">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <div className="text-2xl font-bold tabular-nums">{count == null ? "…" : count.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Active Companies</div>
                </div>
              </div>
            </div>

            {/* Tech badge */}
            <div className="absolute -top-4 -right-4 bg-card/90 backdrop-blur-xl border border-border/50 shadow-lg rounded-xl px-4 py-2 hidden md:flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="text-sm font-medium">Real-time Sync</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
