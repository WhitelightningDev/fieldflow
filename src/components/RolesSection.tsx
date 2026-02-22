import { Shield, Briefcase, Wrench } from "lucide-react";

const roles = [
  {
    icon: Shield,
    name: "Owner / Admin",
    billing: "Free",
    description: "Full platform access. Manages subscription, billing, users, and company settings.",
    capabilities: ["Manage subscription", "Add/remove users", "Access all reports", "Configure integrations"],
  },
  {
    icon: Briefcase,
    name: "Office Staff",
    billing: "Free",
    description: "Create and manage jobs from the dashboard. No field access needed.",
    capabilities: ["Create & assign jobs", "Manage customers", "View reports", "Send invoices"],
  },
  {
    icon: Wrench,
    name: "Technician",
    billing: "Billable seat",
    description: "Mobile-first access for field workers. Assigned to jobs and uses mobile app.",
    capabilities: ["View assigned jobs", "Complete job cards", "Upload photos", "Capture signatures"],
  },
];

const RolesSection = () => {
  return (
    <section id="roles" className="py-16 md:py-24 relative scroll-mt-24">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,hsl(199_89%_48%/0.05),transparent_50%)]" />
      
      <div className="container mx-auto px-4 relative">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Role-based <span className="gradient-text">access control</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Only technicians count toward your bill. Admin and office users are always free.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {roles.map((role, index) => (
            <div
              key={role.name}
              className={`bg-card/80 backdrop-blur-sm border rounded-xl p-6 hover-lift ${
                role.billing === "Billable seat" 
                  ? "border-primary/30" 
                  : "border-border/50"
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  role.billing === "Billable seat" 
                    ? "gradient-bg shadow-glow" 
                    : "bg-secondary"
                }`}>
                  <role.icon className={`h-5 w-5 ${role.billing === "Billable seat" ? "text-primary-foreground" : ""}`} />
                </div>
                <div>
                  <h3 className="font-semibold">{role.name}</h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    role.billing === "Free" 
                      ? "bg-secondary text-secondary-foreground" 
                      : "gradient-bg text-primary-foreground"
                  }`}>
                    {role.billing}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {role.description}
              </p>
              <ul className="space-y-2">
                {role.capabilities.map((cap) => (
                  <li key={cap} className="text-sm flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {cap}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RolesSection;
