import { registerSW } from "virtual:pwa-register";

// Register the service worker for PWA support (offline shell + installability).
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Auto-apply updates to avoid "stuck" cached versions that require clearing site data.
    const key = "fieldflow_pwa_refreshed";
    if (typeof window !== "undefined") {
      try {
        if (window.sessionStorage.getItem(key)) return;
        window.sessionStorage.setItem(key, "1");
      } catch {
        // ignore
      }
    }
    updateSW(true);
  },
});
