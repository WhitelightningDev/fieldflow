const zar = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });

export function formatZarFromCents(cents: number) {
  return zar.format((cents || 0) / 100);
}

// Backwards-compat alias (app displays ZAR everywhere).
export const formatUsdFromCents = formatZarFromCents;
