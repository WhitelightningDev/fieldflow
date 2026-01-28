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
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Role-based access
          </h2>
          <p className="text-muted-foreground text-lg">
            Only technicians count toward your bill. Admin and office users are always free.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {roles.map((role) => (
            <div
              key={role.name}
              className="border-2 border-border p-6 bg-background"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary flex items-center justify-center">
                  <role.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-bold">{role.name}</h3>
                  <span className={`text-xs px-2 py-0.5 ${
                    role.billing === "Free" 
                      ? "bg-accent text-accent-foreground" 
                      : "bg-primary text-primary-foreground"
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
                    <div className="w-1.5 h-1.5 bg-foreground" />
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
