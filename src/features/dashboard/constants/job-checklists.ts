import type { TradeId } from "@/features/company-signup/content/trades";

export const TRADE_JOB_CHECKLISTS: Record<TradeId, string[]> = {
  "electrical-contracting": [
    "Confirm scope and isolate power if required",
    "Capture before photos",
    "Record parts used (cable, breakers, fittings)",
    "Test and verify (continuity / RCD / load)",
    "Capture after photos and customer sign-off",
  ],
  plumbing: [
    "Confirm issue and isolate water if required",
    "Capture before photos",
    "Record parts used (fittings, valves, sealant)",
    "Pressure/leak test",
    "Capture after photos and customer sign-off",
  ],
  "mobile-mechanics": [
    "Confirm symptoms and VIN/reg details",
    "Capture before photos",
    "Record parts used (filters, belts, fluids)",
    "Test drive / diagnostic scan (if applicable)",
    "Capture after photos and customer sign-off",
  ],
  refrigeration: [
    "Confirm fault and site safety requirements",
    "Capture before photos",
    "Record readings and parts used",
    "Leak check / performance test",
    "Capture after photos and customer sign-off",
  ],
  "appliance-repair": [
    "Confirm model/serial and fault symptoms",
    "Capture before photos",
    "Record parts used (boards, fuses, belts)",
    "Run functional test cycle",
    "Capture after photos and customer sign-off",
  ],
};

