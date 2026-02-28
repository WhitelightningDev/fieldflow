import type { TutorialStep } from "@/features/onboarding/types";

export const OVERVIEW_DASHBOARD_TUTORIAL_KEY = "overview-dashboard-v1";

export const overviewDashboardTutorialSteps: TutorialStep[] = [
  {
    id: "header",
    title: "Overview",
    description: "This page gives you a fast snapshot of operations and money so you know what to act on today.",
    targetSelector: '[data-tour="overview-header"]',
    placement: "bottom",
    route: "/dashboard",
  },
  {
    id: "ai-insights",
    title: "AI Insights (optional)",
    description: "If enabled on your plan, AI highlights risks like overdue invoices, scheduling gaps, and low stock.",
    targetSelector: '[data-tour="overview-ai-insights"]',
    placement: "bottom",
    route: "/dashboard",
  },
  {
    id: "kpis",
    title: "KPIs at a glance",
    description: "These cards are quick signals: emergencies, jobs today, unbilled work, and other high-impact items.",
    targetSelector: '[data-tour="kpi-card"]',
    placement: "bottom",
    route: "/dashboard",
  },
  {
    id: "ops-snapshot",
    title: "Operations Snapshot",
    description: "A single place to see dispatch, revenue trends, technician status, live locations, and inventory risk.",
    targetSelector: '[data-tour="ops-snapshot"]',
    placement: "top",
    route: "/dashboard",
  },
  {
    id: "dispatch-board",
    title: "Dispatch board",
    description: "Track what’s scheduled and in progress so nothing slips through the cracks.",
    targetSelector: '[data-tour="ops-dispatch-board"]',
    placement: "right",
    route: "/dashboard",
  },
  {
    id: "financial-trends",
    title: "Financial trends",
    description: "Spot revenue/margin movement and where time + materials are being spent.",
    targetSelector: '[data-tour="ops-financial-trends"]',
    placement: "right",
    route: "/dashboard",
  },
  {
    id: "tech-status",
    title: "Technician status",
    description: "See who is available, on a job, or inactive so you can dispatch confidently.",
    targetSelector: '[data-tour="ops-tech-status"]',
    placement: "left",
    route: "/dashboard",
  },
  {
    id: "tech-locations",
    title: "Live locations",
    description: "If technicians share GPS, you’ll see their last location update and distance to site.",
    targetSelector: '[data-tour="ops-tech-locations"]',
    placement: "left",
    route: "/dashboard",
  },
  {
    id: "low-stock",
    title: "Low stock",
    description: "Below-reorder items and expiring stock are surfaced here to prevent delays and lost profit.",
    targetSelector: '[data-tour="ops-low-stock"]',
    placement: "left",
    route: "/dashboard",
  },
];

