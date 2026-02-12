import type { LucideIcon } from "lucide-react";
import { Car, Droplets, Refrigerator, WashingMachine, Zap } from "lucide-react";

export type TradeId =
  | "electrical-contracting"
  | "plumbing"
  | "mobile-mechanics"
  | "refrigeration"
  | "appliance-repair";

export type Trade = {
  id: TradeId;
  name: string;
  shortName: string;
  icon: LucideIcon;
  hook: string;
  bullets: string[];
};

export const TRADES: Trade[] = [
  {
    id: "electrical-contracting",
    name: "Electrical contractors",
    shortName: "Electrical",
    icon: Zap,
    hook: "Quote, schedule, and invoice—without going back to the office.",
    bullets: ["On-site job notes + photos", "Fast invoicing + payment links", "Customer history for repeat work"],
  },
  {
    id: "plumbing",
    name: "Plumbers",
    shortName: "Plumbing",
    icon: Droplets,
    hook: "Handle call-outs, emergencies, and recurring maintenance with ease.",
    bullets: ["Same-day job cards", "Recurring service reminders", "Get paid before you leave"],
  },
  {
    id: "mobile-mechanics",
    name: "Mobile mechanics",
    shortName: "Mobile mechanics",
    icon: Car,
    hook: "Run your mobile workshop with real-time dispatch and clean job history.",
    bullets: ["Route-ready scheduling", "Parts + labor notes per job", "Mobile-first workflows"],
  },
  {
    id: "refrigeration",
    name: "Refrigeration companies",
    shortName: "Refrigeration",
    icon: Refrigerator,
    hook: "Keep compliance-friendly service records and stay ahead of breakdowns.",
    bullets: ["Detailed service logs", "Photos and signatures", "Recurring maintenance scheduling"],
  },
  {
    id: "appliance-repair",
    name: "Appliance repair companies",
    shortName: "Appliance repair",
    icon: WashingMachine,
    hook: "Turn one-off repairs into repeat customers with faster follow-ups.",
    bullets: ["Warranty & notes tracking", "Customer/job history in one place", "Instant invoices and payments"],
  },
];

export function isTradeId(value: string | null | undefined): value is TradeId {
  if (!value) return false;
  return TRADES.some((trade) => trade.id === value);
}

export function getTradeById(tradeId: TradeId): Trade {
  const trade = TRADES.find((t) => t.id === tradeId);
  if (!trade) {
    throw new Error(`Unknown tradeId: ${tradeId}`);
  }
  return trade;
}

