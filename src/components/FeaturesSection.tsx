import {
  Calendar,
  Users,
  FileText,
  BarChart3,
  Smartphone,
  CreditCard,
  Package,
  MapPin,
  Shield,
  Bot,
  Wrench,
  Bell,
} from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description: "Drag-and-drop job scheduling with calendar views. Assign and dispatch in seconds.",
  },
  {
    icon: Users,
    title: "Customer Management",
    description: "Complete CRM with job history, billing info, sites, and contact details.",
  },
  {
    icon: FileText,
    title: "Digital Job Cards",
    description: "Mobile-ready job cards with checklists, photos, signatures, and real-time sync.",
  },
  {
    icon: Smartphone,
    title: "Technician App",
    description: "Purpose-built mobile experience. Works offline, syncs automatically when online.",
  },
  {
    icon: CreditCard,
    title: "Invoicing & Payments",
    description: "Generate invoices from completed jobs. Send payment links instantly.",
  },
  {
    icon: Package,
    title: "Inventory Tracking",
    description: "Track stock levels, parts usage, reorder points, and costs per job.",
  },
  {
    icon: MapPin,
    title: "Site Management",
    description: "Manage multiple customer sites with GPS, scope templates, and team assignments.",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    description: "Track revenue, profitability, job completion rates, and technician performance.",
  },
  {
    icon: Bot,
    title: "AI Assistant",
    description: "Get intelligent job suggestions, auto-summaries, and operational insights.",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-20 md:py-28 relative scroll-mt-24">
      <div className="absolute inset-0 bg-secondary/30" />

      <div className="container mx-auto px-4 relative">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 border border-accent/20 px-4 py-1.5 mb-4 text-sm font-medium bg-accent/5 rounded-full">
            <span className="text-accent">Core Platform</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            Everything you need to{" "}
            <span className="gradient-text">run your business</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            From scheduling to payments — tools built specifically for field service companies.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group bg-card/70 backdrop-blur-sm border border-border/40 rounded-xl p-6 hover-lift"
            >
              <div className="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center mb-4 group-hover:shadow-glow transition-shadow">
                <feature.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
