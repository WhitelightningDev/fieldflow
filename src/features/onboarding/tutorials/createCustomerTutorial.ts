import type { TutorialStep } from "@/features/onboarding/types";

export const CREATE_CUSTOMER_TUTORIAL_KEY = "create-customer-v1";

export const createCustomerTutorialSteps: TutorialStep[] = [
  {
    id: "open",
    title: "Add your first customer",
    description: "Customers store billing details and job history. Click this button to open the customer form.",
    targetSelector: '[data-tour="customers-add"]',
    placement: "bottom",
    route: "/dashboard/customers",
    dialog: { key: "create-customer", state: "closed" },
  },
  {
    id: "name",
    title: "Customer name",
    description: "Enter the customer/company name (this shows up on job cards and invoices).",
    targetSelector: '[data-tour="customer-name"]',
    placement: "right",
    route: "/dashboard/customers",
    autoClickSelector: '[data-tour="customers-add"]',
    dialog: { key: "create-customer", state: "open" },
  },
  {
    id: "billing",
    title: "Billing contact (recommended)",
    description: "Add a billing email/phone so invoices reach the right person.",
    targetSelector: '[data-tour="customer-billing-email"]',
    placement: "right",
    route: "/dashboard/customers",
    dialog: { key: "create-customer", state: "open" },
  },
  {
    id: "save",
    title: "Save",
    description: "Create the customer. You can edit later if details change.",
    targetSelector: '[data-tour="customer-submit"]',
    placement: "top",
    route: "/dashboard/customers",
    dialog: { key: "create-customer", state: "open" },
  },
];
