export type AiDashboardAction = {
  label: string;
  to: string;
};

type ActionRule = AiDashboardAction & { keywords: string[] };

const ACTION_RULES: ActionRule[] = [
  { label: "Open invoices", to: "/dashboard/invoices", keywords: ["invoice", "invoices", "overdue", "paid", "payment", "billing", "collections"] },
  { label: "Open jobs", to: "/dashboard/jobs", keywords: ["job", "jobs", "dispatch", "schedule", "scheduled", "unassigned", "backlog"] },
  { label: "Open quote requests", to: "/dashboard/quotes", keywords: ["quote", "quotes", "quote request", "quote requests", "estimate", "estimates"] },
  { label: "Open customers", to: "/dashboard/customers", keywords: ["customer", "customers", "client", "clients"] },
  { label: "Open technicians", to: "/dashboard/technicians", keywords: ["technician", "technicians", "tech", "techs"] },
  { label: "Open inventory", to: "/dashboard/inventory", keywords: ["inventory", "stock", "low stock", "parts", "materials"] },
  { label: "Open sites", to: "/dashboard/sites", keywords: ["site", "sites", "address", "location", "locations"] },
  { label: "Open messages", to: "/dashboard/messages", keywords: ["message", "messages", "follow up", "follow-up", "email", "sms", "whatsapp"] },
  { label: "Open settings", to: "/dashboard/settings", keywords: ["settings", "permission", "permissions", "role", "roles"] },
];

function scoreRule(text: string, rule: ActionRule): number {
  let score = 0;
  for (const kw of rule.keywords) {
    if (text.includes(kw)) score += 1;
  }
  return score;
}

export function deriveDashboardActions(
  assistantText: string,
  { max = 3 }: { max?: number } = {},
): AiDashboardAction[] {
  const text = (assistantText ?? "").toLowerCase();
  if (!text.trim()) return [];

  const scored = ACTION_RULES
    .map((rule) => ({ rule, score: scoreRule(text, rule) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const actions = scored.slice(0, max).map((x) => ({ label: x.rule.label, to: x.rule.to }));

  if (actions.length > 0) return actions;

  const looksLikeRecommendations = /\b(recommend(?:ation)?s?|suggest(?:ion)?s?|next steps?|you should|do next|action items?)\b/i.test(assistantText);
  return looksLikeRecommendations ? [{ label: "Open dashboard", to: "/dashboard" }] : [];
}
