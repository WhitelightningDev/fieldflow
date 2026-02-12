import { BarChart3, Calendar, CreditCard, FileText, Smartphone, Users } from "lucide-react";

export const COMPANY_SIGNUP_FEATURES = [
  {
    icon: Calendar,
    title: "Scheduling that scales",
    description: "Dispatch jobs in seconds with calendar views and fast assignment.",
  },
  {
    icon: FileText,
    title: "Digital job cards",
    description: "Capture photos, notes, and signatures on-site with real-time sync.",
  },
  {
    icon: CreditCard,
    title: "Get paid faster",
    description: "Send invoices instantly and take payments online with links.",
  },
  {
    icon: Smartphone,
    title: "Mobile-first for techs",
    description: "A technician experience that works on the road and in the field.",
  },
  {
    icon: Users,
    title: "Customer history",
    description: "Track repeat work with a complete customer and job timeline.",
  },
  {
    icon: BarChart3,
    title: "Reports & insights",
    description: "Keep tabs on performance, revenue, and job completion rates.",
  },
] as const;

