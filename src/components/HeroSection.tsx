import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";

const HeroSection = () => {
  const benefits = [
    "14-day free trial",
    "No credit card required",
    "Cancel anytime",
  ];

  return (
    <section className="pt-24 pb-16 md:pt-32 md:pb-24">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="max-w-xl">
            <div className="inline-block border-2 border-border px-3 py-1 mb-6 text-sm font-medium bg-secondary">
              Field Service Management
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Dispatch smarter.
              <br />
              <span className="underline decoration-4 underline-offset-4">Bill faster.</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              The all-in-one platform for field service companies. Schedule jobs, 
              manage technicians, and get paid—all from one dashboard. 
              Pay only for active technicians.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Button size="lg" className="shadow-sm hover:shadow-md transition-shadow">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg">
                View Demo
              </Button>
            </div>

            <div className="flex flex-wrap gap-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-foreground" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Image */}
          <div className="relative">
            <div className="border-2 border-border shadow-lg overflow-hidden">
              <img
                src={heroImage}
                alt="FieldFlow Dashboard"
                className="w-full h-auto"
              />
            </div>
            {/* Floating Stats Card */}
            <div className="absolute -bottom-6 -left-6 bg-background border-2 border-border shadow-md p-4 hidden md:block">
              <div className="text-3xl font-bold">2,500+</div>
              <div className="text-sm text-muted-foreground">Active Companies</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
