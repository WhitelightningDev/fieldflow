import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Capacitor loads the built app from the filesystem. Vite's default base (`/`)
  // breaks asset URLs in that context, so use a relative base for the "capacitor" mode.
  base: mode === "capacitor" ? "./" : "/",
  server: {
    host: "::",
    port: 8000,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      // "prompt" so the app can show a UI asking the user to reload/close+reopen.
      // This is especially important for installed iOS PWAs where users rarely hard-refresh.
      registerType: "prompt",
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "pwa-192.png",
        "pwa-512.png",
        "pwa-maskable-512.png",
        "apple-splash.png",
      ],
      manifest: {
        name: "FieldFlow",
        short_name: "FieldFlow",
        description: "FieldFlow is a modern field service management platform built for South African trade businesses.",
        start_url: "/login",
        scope: "/",
        display: "standalone",
        theme_color: "#0ea5e9",
        background_color: "#0b1220",
        orientation: "portrait",
        shortcuts: [
          {
            name: "Technician",
            short_name: "Technician",
            description: "Open the technician portal",
            url: "/tech",
            icons: [{ src: "/pwa-192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Dashboard",
            short_name: "Dashboard",
            description: "Open the admin dashboard",
            url: "/dashboard",
            icons: [{ src: "/pwa-192.png", sizes: "192x192", type: "image/png" }],
          },
        ],
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      // Keep the new SW in "waiting" so we can prompt the user before applying the update.
      // (skipWaiting=false is the default, but keep the intent explicit)
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
      },
      // Helps test Web Push locally on http://localhost:8000
      devOptions: { enabled: true },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
