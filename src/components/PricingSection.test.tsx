import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PricingSection from "@/components/PricingSection";

describe("PricingSection", () => {
  it("uses a non-trial CTA for paid plan selection", () => {
    render(
      <MemoryRouter>
        <PricingSection />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: /start free trial/i })).toBeNull();

    const links = screen.getAllByRole("link", { name: /get started/i });
    const hrefs = links.map((a) => a.getAttribute("href"));

    expect(hrefs).toContain("/subscribe?plan=starter");
    expect(hrefs).toContain("/subscribe?plan=pro");
    expect(hrefs).toContain("/subscribe?plan=business");
    expect(links).toHaveLength(3);
  });
});

