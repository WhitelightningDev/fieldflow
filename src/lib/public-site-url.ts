export function getPublicSiteUrl() {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined;
  return (configured && configured.trim()) || window.location.origin;
}

