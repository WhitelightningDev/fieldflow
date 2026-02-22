import type { TutorialStep } from "@/features/onboarding/types";

export const PLUMBER_DASHBOARD_TUTORIAL_KEY = "plumber-dashboard-v1";

export const plumberDashboardTutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome",
    description: "Use the sidebar to move through the core pages. This tour explains what each page is for.",
    targetSelector: '[data-tour="nav-overview"]',
    placement: "right",
  },
  {
    id: "jobs",
    title: "Job cards",
    description: "All work orders in one place: scheduling, status, notes/photos, time, parts, and invoicing state.",
    targetSelector: '[data-tour="nav-jobs"]',
    placement: "right",
  },
  {
    id: "service-calls",
    title: "Service calls",
    description: "Log call-outs and emergencies, filter by urgency, and track compliance tags like Gas CoCs and pressure tests.",
    targetSelector: '[data-tour="nav-service-calls"]',
    placement: "right",
  },
  {
    id: "maintenance",
    title: "Maintenance",
    description: "Set up recurring maintenance plans and prevent missed services with due/overdue tracking.",
    targetSelector: '[data-tour="nav-maintenance-schedules"]',
    placement: "right",
  },
  {
    id: "customers",
    title: "Customers",
    description: "Store billing details, contacts, and job history so quotes/invoices are consistent.",
    targetSelector: '[data-tour="nav-customers"]',
    placement: "right",
  },
  {
    id: "sites",
    title: "Sites",
    description: "Manage addresses, site contacts, team assignments, and site-level job profitability.",
    targetSelector: '[data-tour="nav-sites"]',
    placement: "right",
  },
  {
    id: "technicians",
    title: "Technicians",
    description: "Add technicians, set rates, and (optionally) create technician portal access for mobile job execution.",
    targetSelector: '[data-tour="nav-technicians"]',
    placement: "right",
  },
  {
    id: "inventory",
    title: "Inventory",
    description: "Track fittings/consumables, costs per job, low-stock alerts, and usage.",
    targetSelector: '[data-tour="nav-inventory"]',
    placement: "right",
  },
];
