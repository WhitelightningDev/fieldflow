import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fieldflow.tech",
  appName: "FieldFlow Tech",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    // For development: point to the preview URL for hot-reload
    // Comment this out for production builds
    // url: "https://fa180633-8d61-48a6-a700-2e7a4443117a.lovableproject.com?forceHideBadge=true",
    // cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      backgroundColor: "#0b1220",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;

