import { describe, expect, it } from "vitest";
import { deriveDashboardActions } from "@/features/ai/lib/derive-dashboard-actions";

describe("deriveDashboardActions", () => {
  it("suggests invoices when assistant mentions overdue invoices", () => {
    const actions = deriveDashboardActions("You have several overdue invoices. Recommend sending follow-ups today.");
    expect(actions.some((a) => a.to === "/dashboard/invoices")).toBe(true);
  });

  it("suggests jobs when assistant mentions unassigned jobs", () => {
    const actions = deriveDashboardActions("There are 4 unassigned jobs. Next steps: dispatch them to available techs.");
    expect(actions.some((a) => a.to === "/dashboard/jobs")).toBe(true);
  });

  it("falls back to Open dashboard for recommendation-like text with no clear route", () => {
    const actions = deriveDashboardActions("Recommendations: tighten your SLA targets and review weekly KPIs.");
    expect(actions).toEqual([{ label: "Open dashboard", to: "/dashboard" }]);
  });

  it("returns no actions for non-actionable small talk", () => {
    const actions = deriveDashboardActions("Hello! How can I help?");
    expect(actions).toEqual([]);
  });
});

