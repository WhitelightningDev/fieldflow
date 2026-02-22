import { describe, expect, it } from "vitest";
import { isSolarJob } from "@/features/dashboard/components/trade-dashboards/electrical-dashboard";

describe("electrical-dashboard isSolarJob", () => {
  it("matches solar keywords in title/description", () => {
    expect(isSolarJob({ title: "Solar install - 5kW", description: null })).toBe(true);
    expect(isSolarJob({ title: "PV panel replacement", description: "" })).toBe(true);
    expect(isSolarJob({ title: "DB board upgrade", description: "Replace inverter" })).toBe(true);
  });

  it("does not treat generic electrical trade_id as solar", () => {
    expect(isSolarJob({ title: "Callout", description: "Fix breaker", trade_id: "electrical-contracting" })).toBe(false);
  });
});

