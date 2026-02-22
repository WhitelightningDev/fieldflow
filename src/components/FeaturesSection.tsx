import { 
  Calendar, 
  Users, 
  FileText, 
  BarChart3, 
  Smartphone,
  CreditCard 
} from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Job Scheduling",
    description: "Drag-and-drop scheduling with calendar views. Assign jobs to technicians in seconds.",
  },
  {
    icon: Users,
    title: "Customer Management",
    description: "Complete customer database with job history, notes, and contact details.",
  },
  {
    icon: FileText,
    title: "Digital Job Cards",
    description: "Mobile-friendly job cards with photos, signatures, and real-time sync.",
  },
  {
    icon: Smartphone,
    title: "Mobile App",
    description: "Native mobile experience for technicians. Works offline, syncs when connected.",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    description: "Track performance, revenue, and job completion rates with visual dashboards.",
  },
  {
    icon: CreditCard,
    title: "Invoicing & Payments",
    description: "Generate invoices instantly. Accept payments online with payment links.",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-16 md:py-24 relative scroll-mt-24">
      {/* Background */}
      <div className="absolute inset-0 bg-secondary/50" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(262_83%_58%/0.05),transparent_70%)]" />
      
      <div className="container mx-auto px-4 relative">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 border border-accent/30 px-4 py-1.5 mb-4 text-sm font-medium bg-accent/5 rounded-full">
            <span className="text-accent">Core Platform</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything you need to{" "}
            <span className="gradient-text">run your business</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            From scheduling to payments, we've got you covered with tools built for service companies.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`group bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 hover-lift animate-fade-in-up opacity-0 stagger-${index + 1}`}
            >
              <div className="w-12 h-12 gradient-bg rounded-xl flex items-center justify-center mb-4 group-hover:shadow-glow transition-shadow">
                <feature.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
