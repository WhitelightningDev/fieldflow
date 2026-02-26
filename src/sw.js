import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

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

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon,
      badge,
      renotify: Boolean(tag),
      requireInteraction: false,
      data: { url },
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
