import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import PricingSection from "@/components/PricingSection";
import AddonsSection from "@/components/AddonsSection";
import RolesSection from "@/components/RolesSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import { useLocation } from "react-router-dom";
import * as React from "react";

const Index = () => {
  const location = useLocation();

  React.useEffect(() => {
    const hash = location.hash || "";
    if (!hash.startsWith("#")) return;
    const id = hash.slice(1);
    if (!id) return;

    const tryScroll = () => {
      const el = document.getElementById(id);
      if (!el) return false;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    };

    if (tryScroll()) return;
    const t1 = window.setTimeout(() => { tryScroll(); }, 50);
    const t2 = window.setTimeout(() => { tryScroll(); }, 250);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [location.hash]);

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
