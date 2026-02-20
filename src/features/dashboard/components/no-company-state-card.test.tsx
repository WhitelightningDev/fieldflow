import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NoCompanyStateCard from "@/features/dashboard/components/no-company-state-card";

describe("NoCompanyStateCard", () => {
  it("shows create company link when allowed", () => {
    render(
      <MemoryRouter>
        <NoCompanyStateCard canCreateCompany />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: /create company/i });
    expect(link).toHaveAttribute("href", "/dashboard/create-company");
  });

  it("hides create company link when not allowed", () => {
    render(
      <MemoryRouter>
        <NoCompanyStateCard canCreateCompany={false} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: /create company/i })).toBeNull();
  });

  it("calls retry handler when provided", () => {
    const onRetryLink = vi.fn();
    render(
      <MemoryRouter>
        <NoCompanyStateCard onRetryLink={onRetryLink} canCreateCompany={false} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /retry linking/i }));
    expect(onRetryLink).toHaveBeenCalledTimes(1);
  });
});

