import { registerSW } from "virtual:pwa-register";

// Register the service worker for PWA support (offline shell + installability).
//
// Important: do not auto-reload on update — that can feel like the app is “reloading”
// whenever you background/foreground the tab (especially during active development or frequent deploys).
if (import.meta.env.PROD) {
  registerSW({
    immediate: false,
    onNeedRefresh() {
      // Best-effort: mark that an update exists (you can choose to surface UI later).
      try {
        window.localStorage.setItem("fieldflow_pwa_update_available", "1");
      } catch {
        // ignore
      }
      // No automatic reload here.
    },
  });
}
