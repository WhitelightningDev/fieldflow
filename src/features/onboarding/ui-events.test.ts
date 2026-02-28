import { describe, expect, it, vi } from "vitest";
import { emitOnboardingDialog, subscribeOnboardingDialog } from "@/features/onboarding/ui-events";

describe("onboarding ui-events", () => {
  it("delivers open/close events to subscribers", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeOnboardingDialog(handler);

    emitOnboardingDialog({ key: "create-customer", open: true });
    emitOnboardingDialog({ key: "create-customer", open: false });

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, { key: "create-customer", open: true });
    expect(handler).toHaveBeenNthCalledWith(2, { key: "create-customer", open: false });

    unsubscribe();
  });

  it("ignores invalid payloads", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeOnboardingDialog(handler);

    // @ts-expect-error - invalid detail (runtime guard should ignore)
    window.dispatchEvent(new CustomEvent("fieldflow:onboarding:dialog", { detail: { key: "nope", open: true } }));
    // @ts-expect-error - invalid detail (runtime guard should ignore)
    window.dispatchEvent(new CustomEvent("fieldflow:onboarding:dialog", { detail: { key: "create-site", open: "yes" } }));

    expect(handler).toHaveBeenCalledTimes(0);
    unsubscribe();
  });
});

