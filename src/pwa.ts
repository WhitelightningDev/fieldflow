import { registerSW } from "virtual:pwa-register";

// Register the service worker for PWA support (offline shell + installability).
//
// Important: do not auto-reload on update — that can feel like the app is “reloading”
// whenever you background/foreground the tab (especially during active development or frequent deploys).
type Listener = () => void;

const listeners = new Set<Listener>();
let updateAvailable = false;
let updateFn: ((reloadPage?: boolean) => Promise<void>) | null = null;

export function isPwaUpdateAvailable() {
  return updateAvailable;
}

export function subscribePwaUpdate(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function applyPwaUpdate() {
  if (!updateFn) return;
  // Triggers the waiting SW to activate and then reloads the page so new assets load.
  await updateFn(true);
}

function emitUpdate() {
  for (const l of listeners) {
    try {
      l();
    } catch {
      // ignore
    }
  }
}

if (import.meta.env.PROD) {
  updateFn = registerSW({
    // Check for updates as soon as the app loads.
    immediate: true,
    onNeedRefresh() {
      updateAvailable = true;
      try {
        window.localStorage.setItem("fieldflow_pwa_update_available", "1");
      } catch {
        // ignore
      }
      emitUpdate();
    },
    onRegisteredSW(_swUrl, registration) {
      // Periodically check for updates while the app is open.
      if (!registration) return;
      const update = () => {
        try {
          void registration.update();
        } catch {
          // ignore
        }
      };
      update();
      window.setInterval(update, 60 * 60 * 1000);
    },
  });
}
