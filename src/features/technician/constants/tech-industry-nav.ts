import type { LucideIcon } from "lucide-react";
import type { TradeId } from "@/features/company-signup/content/trades";
import {
  Briefcase,
  Boxes,
  Car,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Navigation,
  Refrigerator,
  ScrollText,
  ShieldCheck,
  Sun,
  Timer,
  WashingMachine,
  Wrench,
} from "lucide-react";

export type TechNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

/** Shared tech nav items */
const SHARED_TECH_NAV: TechNavItem[] = [
  { to: "/tech", label: "Dispatch", icon: Navigation },
  { to: "/tech/my-jobs", label: "My jobs", icon: Briefcase },
  { to: "/tech/inventory", label: "Inventory", icon: Boxes },
  { to: "/tech/messages", label: "Messages", icon: MessageSquare },
];

/** Industry-specific tech nav items */
const INDUSTRY_TECH_NAV: Record<TradeId, TechNavItem[]> = {
  "electrical-contracting": [
    { to: "/tech/solar", label: "Solar tasks", icon: Sun },
    { to: "/tech/coc", label: "COC certs", icon: ShieldCheck },
  ],
  plumbing: [
    { to: "/tech/service-calls", label: "Service calls", icon: Timer },
  ],
  "mobile-mechanics": [
    { to: "/tech/vehicle-logs", label: "Vehicle logs", icon: Car },
  ],
  refrigeration: [
    { to: "/tech/service-logs", label: "Service logs", icon: ScrollText },
    { to: "/tech/compliance", label: "Compliance", icon: ClipboardCheck },
  ],
  "appliance-repair": [
    { to: "/tech/warranty", label: "Warranty", icon: FileText },
    { to: "/tech/repairs", label: "Repairs", icon: WashingMachine },
  ],
};

export function getTechIndustryNav(industry: string | null | undefined): TechNavItem[] {
  const industryItems = (industry && industry in INDUSTRY_TECH_NAV)
    ? INDUSTRY_TECH_NAV[industry as TradeId]
    : [];

  if (industryItems.length === 0) return SHARED_TECH_NAV;

  return [
    ...SHARED_TECH_NAV.slice(0, 2), // Dispatch + My jobs
    ...industryItems,
    ...SHARED_TECH_NAV.slice(2), // Inventory
  ];
}
