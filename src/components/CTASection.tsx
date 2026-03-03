import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const CTASection = () => {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 gradient-bg" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),transparent_70%)]" />

      <div className="container mx-auto px-4 relative">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary-foreground tracking-tight">
            Ready to streamline your operations?
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-8 leading-relaxed">
            Join hundreds of service companies using FieldFlow to dispatch smarter and bill faster.
            Start your 14-day free trial today.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="bg-background text-foreground hover:bg-background/90 shadow-xl text-base px-8"
            >
              <Link to="/plan-wizard">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 backdrop-blur-sm text-base px-8"
            >
              <Link to="/contact?subject=Demo%20request">Schedule a Demo</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
