import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import {
  explainDeniedNotifications,
  getSystemNotificationPermission,
  getSystemNotificationsEnabled,
  isSystemNotificationsSupported,
  requestSystemNotificationPermission,
  setSystemNotificationsEnabled,
  showSystemNotification,
} from "@/lib/system-notifications";
import { Bell, Navigation } from "lucide-react";
import * as React from "react";

const GPS_ENABLE_KEY = "fieldflow_gps_sharing_enabled";

type GeoPermission = "granted" | "denied" | "prompt" | "unknown" | "unsupported";

function describeGeoPermission(p: GeoPermission) {
  if (p === "unsupported") return "Not supported";
  if (p === "granted") return "Allowed";
  if (p === "denied") return "Blocked";
  if (p === "prompt") return "Not enabled";
  return "Unknown";
}

export default function TechSettings() {
  const [gpsEnabled, setGpsEnabled] = React.useState(() => {
    try {
      return window.localStorage.getItem(GPS_ENABLE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [geoPermission, setGeoPermission] = React.useState<GeoPermission>("unknown");
  const [gpsRequesting, setGpsRequesting] = React.useState(false);

  const [notifPermission, setNotifPermission] = React.useState<NotificationPermission | "unsupported">(() => getSystemNotificationPermission());
  const [notifEnabled, setNotifEnabled] = React.useState(() => (typeof window === "undefined" ? false : getSystemNotificationsEnabled()));
  const [notifRequesting, setNotifRequesting] = React.useState(false);

  const hasGeo = React.useMemo(() => typeof window !== "undefined" && "geolocation" in navigator, []);

  React.useEffect(() => {
    if (!hasGeo) {
      setGeoPermission("unsupported");
      return;
    }

    let cancelled = false;
    let status: PermissionStatus | null = null;

    (async () => {
      try {
        const permissions = (navigator as any).permissions;
        if (!permissions?.query) {
          setGeoPermission("unknown");
          return;
        }
        status = await permissions.query({ name: "geolocation" });
        if (cancelled) return;
        setGeoPermission(status.state ?? "unknown");
        status.onchange = () => {
          if (cancelled) return;
          setGeoPermission(status?.state ?? "unknown");
        };
      } catch {
        setGeoPermission("unknown");
      }
    })();

    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, [hasGeo]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(GPS_ENABLE_KEY, gpsEnabled ? "1" : "0");
    } catch {
      // ignore
    }
    if (gpsEnabled) {
      try {
        void (navigator as any).storage?.persist?.();
      } catch {
        // ignore
      }
    }
  }, [gpsEnabled]);

  React.useEffect(() => {
    setNotifPermission(getSystemNotificationPermission());
    setNotifEnabled(getSystemNotificationsEnabled());
  }, []);

  const requestGpsPermission = React.useCallback(async () => {
    if (!hasGeo) {
      toast({ title: "GPS not supported", description: "This device/browser doesn't support location sharing.", variant: "destructive" });
      return false;
    }
    setGpsRequesting(true);
    try {
      const ok = await new Promise<boolean>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          () => resolve(false),
          { enableHighAccuracy: false, maximumAge: 30_000, timeout: 15_000 },
        );
      });
      return ok;
    } finally {
      setGpsRequesting(false);
    }
  }, [hasGeo]);

  const enableNotifications = React.useCallback(async () => {
    if (!isSystemNotificationsSupported()) {
      setNotifPermission("unsupported");
      toast({ title: "Not supported", description: "This device/browser doesn't support notifications.", variant: "destructive" });
      return false;
    }
    setNotifRequesting(true);
    try {
      const p = await requestSystemNotificationPermission();
      setNotifPermission(p);
      if (p === "granted") {
        setNotifEnabled(true);
        setSystemNotificationsEnabled(true);
        await showSystemNotification({ title: "FieldFlow notifications enabled", body: "You'll receive job updates here." });
        return true;
      }
      if (p === "denied") explainDeniedNotifications();
      return false;
    } finally {
      setNotifRequesting(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Control GPS sharing and device alerts.</p>
      </div>

      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Navigation className="h-4 w-4" />
            Live GPS sharing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Share my location</div>
              <div className="text-xs text-muted-foreground">
                Permission: {describeGeoPermission(geoPermission)}
              </div>
            </div>
            <Switch
              checked={gpsEnabled}
              disabled={geoPermission === "unsupported" || gpsRequesting}
              onCheckedChange={async (next) => {
                if (!next) {
                  setGpsEnabled(false);
                  toast({ title: "Live GPS off", description: "Your location will no longer be shared from this device." });
                  return;
                }

                const ok = await requestGpsPermission();
                if (!ok) {
                  toast({
                    title: "Live GPS off",
                    description: "Location permission is blocked or unavailable. Enable Location for this site/app, then try again.",
                    variant: "destructive",
                  });
                  setGpsEnabled(false);
                  return;
                }
                setGpsEnabled(true);
                toast({ title: "Live GPS enabled", description: "Keep the dispatch screen open while traveling so GPS can update." });
              }}
              aria-label="Enable live GPS sharing"
            />
          </div>

          <div className="text-xs text-muted-foreground">
            iPhone/iPad PWAs pause GPS updates when the screen locks or the app is fully closed. GPS resumes when you reopen the app.
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Device notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Job alerts</div>
              <div className="text-xs text-muted-foreground">
                Permission: {notifPermission === "unsupported" ? "Not supported" : notifPermission}
              </div>
            </div>
            <Switch
              checked={notifEnabled && notifPermission === "granted"}
              disabled={notifPermission !== "granted" || notifRequesting}
              onCheckedChange={(v) => {
                setNotifEnabled(Boolean(v));
                setSystemNotificationsEnabled(Boolean(v));
              }}
              aria-label="Enable device notifications"
            />
          </div>

          {isSystemNotificationsSupported() && notifPermission !== "granted" ? (
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-8" disabled={notifRequesting} onClick={enableNotifications}>
                {notifRequesting ? "Requesting..." : notifPermission === "denied" ? "Retry" : "Enable"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => showSystemNotification({ title: "Test notification", body: "If you can read this, alerts are working." })}
              >
                Test
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-end">
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => showSystemNotification({ title: "Test notification", body: "If you can read this, alerts are working." })}
              >
                Test
              </Button>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            For best results on iOS, install the app via “Add to Home Screen”. (Background push requires extra setup.)
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

