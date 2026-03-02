import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFeatureGate } from "@/features/subscription/hooks/use-feature-gate";

describe("useFeatureGate.isRouteAllowed", () => {
  it("blocks /dashboard/ai for starter and pro", () => {
    const { result, rerender } = renderHook(
      ({ tier }) => useFeatureGate(tier as any),
      { initialProps: { tier: "starter" } },
    );

    expect(result.current.isRouteAllowed("/dashboard/ai")).toBe(false);
    rerender({ tier: "pro" });
    expect(result.current.isRouteAllowed("/dashboard/ai")).toBe(false);
  });

  it("allows /dashboard/ai for business", () => {
    const { result } = renderHook(
      ({ tier }) => useFeatureGate(tier as any),
      { initialProps: { tier: "business" } },
    );

    expect(result.current.isRouteAllowed("/dashboard/ai")).toBe(true);
  });

  it("blocks /dashboard/quotes for starter and pro", () => {
    const { result, rerender } = renderHook(
      ({ tier }) => useFeatureGate(tier as any),
      { initialProps: { tier: "starter" } },
    );

    expect(result.current.isRouteAllowed("/dashboard/quotes")).toBe(false);
    rerender({ tier: "pro" });
    expect(result.current.isRouteAllowed("/dashboard/quotes")).toBe(false);
  });

  it("allows /dashboard/quotes for business", () => {
    const { result } = renderHook(
      ({ tier }) => useFeatureGate(tier as any),
      { initialProps: { tier: "business" } },
    );

    expect(result.current.isRouteAllowed("/dashboard/quotes")).toBe(true);
  });
});
