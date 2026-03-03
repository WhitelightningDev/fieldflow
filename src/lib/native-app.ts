/**
 * Detects whether the app is running inside a Capacitor native shell.
 * When running as a native app, the technician experience is the primary UI.
 */
export function isNativeApp(): boolean {
  // Capacitor injects this on the window object
  return !!(window as any).Capacitor?.isNativePlatform?.() || !!(window as any).Capacitor?.isNative;
}

/**
 * The default route for the native (technician) app.
 */
export const NATIVE_DEFAULT_ROUTE = "/tech";
