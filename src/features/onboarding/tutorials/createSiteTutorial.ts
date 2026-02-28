import type { TutorialStep } from "@/features/onboarding/types";

export const CREATE_SITE_TUTORIAL_KEY = "create-site-v1";

export const createSiteTutorialSteps: TutorialStep[] = [
  {
    id: "open",
    title: "Create your first site",
    description: "Sites are the physical locations where work happens. Click to open the site form.",
    targetSelector: '[data-tour="sites-add"]',
    placement: "bottom",
    route: "/dashboard/sites",
    dialog: { key: "create-site", state: "closed" },
  },
  {
    id: "name",
    title: "Site name",
    description: "Use a clear name (e.g. complex/building + unit) so dispatch is unambiguous.",
    targetSelector: '[data-tour="site-name"]',
    placement: "right",
    route: "/dashboard/sites",
    autoClickSelector: '[data-tour="sites-add"]',
    dialog: { key: "create-site", state: "open" },
  },
  {
    id: "customer",
    title: "Link a customer (optional)",
    description: "Linking a customer helps with billing references and history.",
    targetSelector: '[data-tour="site-customer"]',
    placement: "right",
    route: "/dashboard/sites",
    dialog: { key: "create-site", state: "open" },
  },
  {
    id: "save",
    title: "Save",
    description: "Create the site. You can add GPS later to improve arrival detection.",
    targetSelector: '[data-tour="site-submit"]',
    placement: "top",
    route: "/dashboard/sites",
    dialog: { key: "create-site", state: "open" },
  },
];
