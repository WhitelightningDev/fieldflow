import type { TutorialStep } from "@/features/onboarding/types";

export const ADD_TECHNICIAN_TUTORIAL_KEY = "add-technician-v1";

export const addTechnicianTutorialSteps: TutorialStep[] = [
  {
    id: "open",
    title: "Add your first technician",
    description: "Technicians are the people you dispatch to jobs. Click to open the technician access form.",
    targetSelector: '[data-tour="technicians-add"]',
    placement: "bottom",
    route: "/dashboard/technicians",
    dialog: { key: "create-technician-primary", state: "closed" },
  },
  {
    id: "identity",
    title: "Identity + login",
    description: "Add name and email. This email becomes their technician portal login.",
    targetSelector: '[data-tour="technician-name"]',
    placement: "right",
    route: "/dashboard/technicians",
    autoClickSelector: '[data-tour="technicians-add"]',
    dialog: { key: "create-technician-primary", state: "open" },
  },
  {
    id: "password",
    title: "Initial password",
    description: "Set a strong initial password (or generate one). Share it with the technician securely.",
    targetSelector: '[data-tour="technician-password"]',
    placement: "right",
    route: "/dashboard/technicians",
    dialog: { key: "create-technician-primary", state: "open" },
  },
  {
    id: "save",
    title: "Create access",
    description: "This provisions technician portal access and creates their technician record.",
    targetSelector: '[data-tour="technician-submit"]',
    placement: "top",
    route: "/dashboard/technicians",
    dialog: { key: "create-technician-primary", state: "open" },
  },
];
