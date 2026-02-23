import { describe, expect, it } from "vitest";
import { getJobSuggestions, suggestAssignee } from "@/features/dashboard/lib/job-suggestions";

describe("job-suggestions", () => {
  it("suggestAssignee prefers most recent site technician", () => {
    const suggestion = suggestAssignee({
      tradeId: "plumbing",
      siteId: "site-1",
      customerId: "cust-1",
      siteLatLng: { lat: -26.2, lng: 28.0 },
      technicians: [
        { id: "t1", name: "A", active: true, trades: ["plumbing"], invite_status: "accepted" } as any,
        { id: "t2", name: "B", active: true, trades: ["plumbing"], invite_status: "accepted" } as any,
      ],
      jobCards: [
        { id: "j1", trade_id: "plumbing", site_id: "site-1", customer_id: "cust-1", technician_id: "t1", status: "completed", title: "Leak repair", updated_at: "2026-02-01T00:00:00Z" } as any,
        { id: "j2", trade_id: "plumbing", site_id: "site-1", customer_id: "cust-1", technician_id: "t2", status: "completed", title: "Geyser service", updated_at: "2026-02-10T00:00:00Z" } as any,
      ],
      technicianLocations: [
        { technician_id: "t1", latitude: -26.25, longitude: 28.1, updated_at: "2026-02-11T00:00:00Z" } as any,
      ],
    });

    expect(suggestion?.technicianId).toBe("t2");
    expect(suggestion?.reason).toMatch(/site/i);
  });

  it("suggestAssignee falls back to nearest technician by location", () => {
    const suggestion = suggestAssignee({
      tradeId: "electrical-contracting",
      siteId: "site-1",
      customerId: "cust-1",
      siteLatLng: { lat: -26.2, lng: 28.0 },
      technicians: [
        { id: "t1", name: "A", active: true, trades: ["electrical-contracting"], invite_status: "accepted" } as any,
        { id: "t2", name: "B", active: true, trades: ["electrical-contracting"], invite_status: "accepted" } as any,
      ],
      jobCards: [],
      technicianLocations: [
        { technician_id: "t1", latitude: -26.25, longitude: 28.2, updated_at: "2026-02-11T00:00:00Z" } as any,
        { technician_id: "t2", latitude: -26.21, longitude: 28.01, updated_at: "2026-02-11T00:00:00Z" } as any,
      ],
    });

    expect(suggestion?.technicianId).toBe("t2");
    expect(suggestion?.reason).toMatch(/nearest/i);
    expect(typeof suggestion?.distanceMeters).toBe("number");
  });

  it("getJobSuggestions excludes titles already open at the site", () => {
    const out = getJobSuggestions({
      tradeId: "plumbing",
      siteId: "site-1",
      customerId: "cust-1",
      max: 6,
      jobCards: [
        { id: "j1", trade_id: "plumbing", site_id: "site-1", customer_id: "cust-1", technician_id: null, status: "new", title: "Leak detection & repair", updated_at: "2026-02-10T00:00:00Z" } as any,
        { id: "j2", trade_id: "plumbing", site_id: "site-1", customer_id: "cust-1", technician_id: null, status: "invoiced", title: "Blocked drain / pipe clearing", updated_at: "2026-02-01T00:00:00Z" } as any,
      ],
    });

    expect(out.some((s) => s.title === "Leak detection & repair")).toBe(false);
    expect(out.length).toBeGreaterThan(0);
  });
});

