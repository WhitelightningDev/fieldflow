export function getPublicSiteUrl() {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined;
  const cfg = (configured && configured.trim()) || "";
  if (cfg) return cfg.replace(/\/+$/, "");

  const origin = window.location.origin;
  // If this app is opened on a Lovable preview domain, never generate auth redirects to it.
  if (origin.includes(".lovableproject.com")) {
    return "https://fieldflow-billing.vercel.app";
  }
  return origin;
}
