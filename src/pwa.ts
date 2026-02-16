import { registerSW } from "virtual:pwa-register";

// Register the service worker for PWA support (offline shell + installability).
registerSW({
  immediate: true,
});

