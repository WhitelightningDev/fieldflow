import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const CTASection = () => {
  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-bg" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1),transparent_70%)]" />
      
      {/* Floating elements */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-background/10 rounded-full blur-2xl" />
      <div className="absolute bottom-10 right-10 w-40 h-40 bg-background/10 rounded-full blur-2xl" />
      
      <div className="container mx-auto px-4 relative">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 border border-primary-foreground/30 px-4 py-1.5 mb-6 text-sm font-medium bg-primary-foreground/10 rounded-full">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
            <span className="text-primary-foreground">Start in minutes</span>
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-primary-foreground">
            Ready to streamline your field service operations?
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-8">
            Start your 14-day free trial today. No credit card required. 
            Get up and running in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="bg-background text-foreground hover:bg-background/90 shadow-xl"
            >
              <Link to="/company-signup">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 backdrop-blur-sm"
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
