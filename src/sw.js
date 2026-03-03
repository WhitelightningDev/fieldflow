import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Allow the app to trigger activation of a waiting SW (used by `virtual:pwa-register`).
// We intentionally do NOT call `self.skipWaiting()` automatically so we can prompt users.
self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") {
    try {
      void self.skipWaiting();
    } catch {
      // ignore
    }
  }
});

// SPA navigation fallback, but don't hijack Supabase endpoints.
const navigationHandler = createHandlerBoundToURL("/index.html");
registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/rest\/v1\//, /^\/auth\/v1\//, /^\/functions\/v1\//],
  }),
);

// Cache images aggressively (same behavior as previous GenerateSW config).
registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: "images",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
);

function parsePushPayload(event) {
  try {
    const json = event?.data?.json?.();
    if (json && typeof json === "object") return json;
  } catch {
    // ignore
  }
  try {
    const text = event.data?.text?.() ?? "";
    if (text) return { title: text };
  } catch {
    // ignore
  }
  return {};
}

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);
  const title = payload.title?.trim() || "FieldFlow";
  const body = payload.body?.trim() || undefined;
  const url = payload.url?.trim() || "/";
  const tag = payload.tag?.trim();

  const icon = payload.icon ?? "/pwa-192.png";
  const badge = payload.badge ?? "/pwa-192.png";

  // IMPORTANT: Always show notification on push, even when app is in foreground.
  // This ensures Samsung/Apple devices show notifications when idle/locked.
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon,
      badge,
      renotify: Boolean(tag),
      requireInteraction: false,
      data: { url },
      // Vibrate pattern for Android (ignored on iOS)
      vibrate: [200, 100, 200],
      // Show timestamp for when the push was received
      timestamp: Date.now(),
      // Actions for interactive notifications (Android)
      actions: payload.actions ?? [],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = String(event.notification?.data?.url ?? "/");

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        try {
          await client.focus();
          if (url) {
            try {
              await client.navigate(url);
            } catch {
              // ignore navigation failures (iOS quirks)
            }
          }
          return;
        } catch {
          // ignore
        }
      }

      await self.clients.openWindow(url);
    })(),
  );
});
