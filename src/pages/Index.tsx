import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import PricingSection from "@/components/PricingSection";
import AddonsSection from "@/components/AddonsSection";
import RolesSection from "@/components/RolesSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <FeaturesSection />
        <RolesSection />
        <PricingSection />
        <AddonsSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
