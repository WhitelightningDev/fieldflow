const usd = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });

export function formatUsdFromCents(cents: number) {
  return usd.format((cents || 0) / 100);
}

