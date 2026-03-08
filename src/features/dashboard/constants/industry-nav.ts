import type { LucideIcon } from "lucide-react";
import type { TradeId } from "@/features/company-signup/content/trades";
import {
  Briefcase,
  Boxes,
  Building2,
  Car,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Sparkles,
  Refrigerator,
  Receipt,
  Settings,
  ShieldCheck,
  Sun,
  Timer,
  Users,
  Users2,
  WashingMachine,
  Wrench,
  CalendarClock,
  ScrollText,
  Package,
  ZapOff,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

/** Shared nav items that appear for every industry */
const SHARED_NAV: NavItem[] = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/dashboard/jobs", label: "Job cards", icon: Briefcase },
  { to: "/dashboard/invoices", label: "Invoices", icon: Receipt },
  { to: "/dashboard/sites", label: "Sites", icon: Building2 },
  { to: "/dashboard/customers", label: "Customers", icon: Users },
  { to: "/dashboard/technicians", label: "Technicians", icon: Wrench },
  { to: "/dashboard/teams", label: "Teams", icon: Users2 },
  { to: "/dashboard/inventory", label: "Inventory", icon: Boxes },
  { to: "/dashboard/quotes", label: "Quote requests", icon: FileText },
  { to: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { to: "/dashboard/ai", label: "AI Assistant", icon: Sparkles },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

/** Industry-specific nav items inserted after "Invoices" */
const INDUSTRY_NAV: Record<TradeId, NavItem[]> = {
  "electrical-contracting": [
    { to: "/dashboard/solar", label: "Solar projects", icon: Sun },
    { to: "/dashboard/coc-certificates", label: "COC Certificates", icon: ShieldCheck },
  ],
  plumbing: [
    { to: "/dashboard/service-calls", label: "Service calls", icon: Timer },
    { to: "/dashboard/maintenance-schedules", label: "Maintenance", icon: CalendarClock },
  ],
  "mobile-mechanics": [
    { to: "/dashboard/vehicle-logs", label: "Vehicle logs", icon: Car },
    { to: "/dashboard/parts-catalog", label: "Parts catalog", icon: Package },
  ],
  refrigeration: [
    { to: "/dashboard/service-logs", label: "Service logs", icon: ScrollText },
    { to: "/dashboard/compliance", label: "Compliance records", icon: ClipboardCheck },
  ],
  "appliance-repair": [
    { to: "/dashboard/warranty-tracker", label: "Warranty tracker", icon: FileText },
    { to: "/dashboard/repair-history", label: "Repair history", icon: WashingMachine },
  ],
};

/**
 * Build the full sidebar nav for a given industry.
 * Industry-specific items are inserted right after "Invoices".
 */
export function getIndustryNav(industry: string | null | undefined): NavItem[] {
  const industryItems = (industry && industry in INDUSTRY_NAV)
    ? INDUSTRY_NAV[industry as TradeId]
    : [];

  if (industryItems.length === 0) return SHARED_NAV;

  // Insert industry items after "Invoices" (index 2)
  return [
    ...SHARED_NAV.slice(0, 3), // Overview + Job cards + Invoices
    ...industryItems,
    ...SHARED_NAV.slice(3),    // Sites, Customers, etc.
  ];
}
