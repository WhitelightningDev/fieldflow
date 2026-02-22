import type { TutorialStep } from "@/features/onboarding/types";

export const PLUMBER_DASHBOARD_TUTORIAL_KEY = "plumber-dashboard-v1";

export const plumberDashboardTutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to your Plumbing Overview",
    description:
      "This quick tour shows where to spot today’s workload, cashflow risk, and compliance alerts. You can skip anytime.",
    targetSelector: '[data-tour="plumber-header"]',
    placement: "bottom",
    route: "/dashboard",
  },
  {
    id: "kpis",
    title: "Business health KPIs",
    description:
      "Track completion rate, backlog, revenue per tech, break-even, billing backlog, and repeat customers at a glance.",
    targetSelector: '[data-tour="plumber-kpis"]',
    placement: "bottom",
    route: "/dashboard",
  },
  {
    id: "dispatch",
    title: "Scheduling & dispatch",
    description:
      "Use the dispatch timeline to see today’s jobs, assignments, and delays so you can intervene early.",
    targetSelector: '[data-tour="plumber-dispatch-timeline"]',
    placement: "top",
    route: "/dashboard",
  },
  {
    id: "tech-status",
    title: "Live technician status",
    description:
      "See who’s on-site, en route, completed, or idle. GPS freshness helps spot stale location updates.",
    targetSelector: '[data-tour="plumber-live-tech-status"]',
    placement: "left",
    route: "/dashboard",
  },
  {
    id: "compliance",
    title: "Compliance & safety alerts",
    description:
      "Keep an eye on open Gas CoCs, PIRB CoCs, and pressure tests. These reduce rework and regulatory risk.",
    targetSelector: '[data-tour="plumber-compliance-kpis"]',
    placement: "bottom",
    route: "/dashboard",
  },
  {
    id: "service-calls",
    title: "Service calls: filter fast",
    description:
      "Use filters to find emergencies, after-hours work, and tagged compliance items (e.g. #gas-coc, #pressure-test).",
    targetSelector: '[data-tour="servicecalls-filters"]',
    placement: "bottom",
    route: "/dashboard/service-calls",
  },
  {
    id: "maintenance",
    title: "Maintenance schedules",
    description:
      "Recurring maintenance plans prevent failures and smooth workload. Watch overdue and due-soon items.",
    targetSelector: '[data-tour="maintenance-stats"]',
    placement: "bottom",
    route: "/dashboard/maintenance-schedules",
  },
  {
    id: "reports",
    title: "Deep insights",
    description:
      "Jump into full reports: service calls, maintenance, job cards, technicians, inventory, customers, and sites.",
    targetSelector: '[data-tour="plumber-reports-links"]',
    placement: "top",
    route: "/dashboard",
  },
];

