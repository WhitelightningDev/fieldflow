import { useAuth } from "@/features/auth/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  Droplets,
  FileSignature,
  Flame,
  MapPin,
  Navigation,
  Phone,
  Play,
  RefreshCcw,
  User,
} from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";
import { useRealtimeRefetch } from "@/hooks/use-realtime-refetch";
import { formatDistanceToNowStrict } from "date-fns";

function isToday(dateStr: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

const statusColor: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  scheduled: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "in-progress": "bg-green-500/10 text-green-700 dark:text-green-400",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  invoiced: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  cancelled: "bg-destructive/10 text-destructive",
};

const priorityColor: Record<string, string> = {
  urgent: "bg-destructive/10 text-destructive",
  emergency: "bg-destructive/10 text-destructive",
  high: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  normal: "",
  low: "bg-muted text-muted-foreground",
};

export default function TechDispatch() {
  const { user, profile } = useAuth();
  const [jobs, setJobs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [technicianId, setTechnicianId] = React.useState<string | null>(null);
  const [geoPermission, setGeoPermission] = React.useState<"granted" | "denied" | "prompt" | "unknown">("unknown");
  const [gpsStartRequested, setGpsStartRequested] = React.useState(false);
  const [gpsRequesting, setGpsRequesting] = React.useState(false);
  const [lastSentAtMs, setLastSentAtMs] = React.useState<number | null>(null);
  const jobsRef = React.useRef<any[]>([]);
  const lastLocationSentAtRef = React.useRef<number>(0);
  const lastLocationPayloadRef = React.useRef<string>("");
  const geoErrorShownRef = React.useRef(false);
  const gpsWriteErrorShownRef = React.useRef(false);

  React.useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const refreshJobs = React.useCallback(async () => {
    if (!user?.id) return;

    const { data: tech, error: techErr } = await supabase
      .from("technicians")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (techErr) {
      toast({ title: "Could not load technician", description: techErr.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    if (!tech?.id) {
      setTechnicianId(null);
      setJobs([]);
      setLoading(false);
      return;
    }

    setTechnicianId(tech.id);
    const { data, error } = await supabase
      .from("job_cards")
      .select("*, customers(name, phone, address), sites(name, address)")
      .eq("technician_id", tech.id)
      .order("scheduled_at", { ascending: true });
    if (error) {
      toast({ title: "Could not load jobs", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setJobs(data ?? []);
    setLoading(false);
  }, [user?.id]);

  React.useEffect(() => {
    setLoading(true);
    void refreshJobs();
  }, [refreshJobs]);

  useRealtimeRefetch({
    enabled: Boolean(profile?.company_id),
    channelName: `tech-dispatch:job_cards:${profile?.company_id ?? "none"}`,
    table: "job_cards",
    filter: profile?.company_id ? `company_id=eq.${profile.company_id}` : undefined,
    debounceMs: 800,
    onRefetch: refreshJobs,
  });

  const isTouch = React.useMemo(() => {
    return (navigator.maxTouchPoints ?? 0) > 0 || window.matchMedia("(pointer: coarse)").matches;
  }, []);

  const hasGeo = React.useMemo(() => "geolocation" in navigator, []);

  React.useEffect(() => {
    if (!hasGeo) return;
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

  const sendLocation = React.useCallback(async (pos: GeolocationPosition) => {
    if (!user?.id || !profile?.company_id || !technicianId) return;

    const now = Date.now();
    const MIN_SEND_MS = 15_000;
    const HEARTBEAT_MS = 60_000;
    if (now - lastLocationSentAtRef.current < MIN_SEND_MS) return;

    const activeJob =
      jobsRef.current.find((j: any) => j.status === "in-progress") ??
      jobsRef.current.find((j: any) => j.status === "scheduled") ??
      null;

    const basePayload = {
      technician_id: technicianId,
      company_id: profile.company_id,
      user_id: user.id,
      job_card_id: activeJob?.id ?? null,
      site_id: activeJob?.site_id ?? null,
      accuracy: typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null,
      heading: typeof pos.coords.heading === "number" ? pos.coords.heading : null,
      speed: typeof pos.coords.speed === "number" ? pos.coords.speed : null,
      recorded_at: new Date(pos.timestamp).toISOString(),
    };

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") return;
    if (!basePayload.technician_id) return;

    const payloadKey = JSON.stringify({
      t: basePayload.technician_id,
      j: basePayload.job_card_id,
      s: basePayload.site_id,
      la: Math.round(lat * 1e5),
      ln: Math.round(lng * 1e5),
    });

    if (payloadKey === lastLocationPayloadRef.current && now - lastLocationSentAtRef.current < HEARTBEAT_MS) return;

    lastLocationSentAtRef.current = now;
    lastLocationPayloadRef.current = payloadKey;
    setLastSentAtMs(now);

    // DB schema has existed with either `lat/lng` or `latitude/longitude` fields.
    // Try the preferred `lat/lng` first, then fall back to `latitude/longitude` if needed.
    const payloadLatLng = { ...basePayload, lat, lng };
    const payloadLatitudeLongitude = { ...basePayload, latitude: lat, longitude: lng };
    let rowToWrite: any = payloadLatLng;

    const writeUpsert = async (row: any) => {
      return await supabase.from("technician_locations").upsert(row as any, { onConflict: "technician_id" });
    };

    let { error } = await writeUpsert(payloadLatLng);
    if (error) {
      const msg = String(error.message ?? "").toLowerCase();
      const isMissingLatLng = msg.includes("column") && msg.includes("does not exist") && (msg.includes("lat") || msg.includes("lng"));
      if (isMissingLatLng) {
        rowToWrite = payloadLatitudeLongitude;
        ({ error } = await writeUpsert(rowToWrite));
      }
    }

    if (error && !gpsWriteErrorShownRef.current) {
      gpsWriteErrorShownRef.current = true;
      const msg = String(error.message ?? "");
      const lower = msg.toLowerCase();
      const hint = lower.includes("on conflict") || lower.includes("no unique") || lower.includes("exclusion constraint")
        ? " Fix: apply latest Supabase migrations (unique index on technician_locations.technician_id)."
        : "";
      toast({
        title: "Live GPS not saving",
        description: `${error.message}${hint}`,
        variant: "destructive",
      });
    }

    // Robust fallback: if the DB is missing a UNIQUE constraint for `onConflict=technician_id`,
    // do an update-or-insert to keep tracking working until migrations are applied.
    if (error) {
      const msg = String(error.message ?? "");
      const lower = msg.toLowerCase();
      const isOnConflictConstraintIssue =
        lower.includes("no unique") ||
        lower.includes("exclusion constraint") ||
        lower.includes("on conflict");
      if (!isOnConflictConstraintIssue) return;

      const { data: updatedRows, error: updateErr } = await supabase
        .from("technician_locations")
        .update(rowToWrite as any)
        .eq("technician_id", basePayload.technician_id)
        .select("technician_id")
        .limit(1);

      if (updateErr) return;
      if ((updatedRows?.length ?? 0) > 0) return;

      await supabase.from("technician_locations").insert(rowToWrite as any);
    }
  }, [profile?.company_id, technicianId, user?.id]);

  const requestGps = React.useCallback(async () => {
    if (!hasGeo) {
      toast({ title: "GPS not supported", description: "This device/browser doesn't support location sharing.", variant: "destructive" });
      return;
    }
    setGpsStartRequested(true);
    setGpsRequesting(true);
    geoErrorShownRef.current = false;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsRequesting(false);
        setGeoPermission("granted");
        void sendLocation(pos);
        toast({ title: "Live GPS enabled", description: "Your location will be shared with your admin while this dispatch screen is open." });
      },
      (err) => {
        setGpsRequesting(false);
        if (err?.code === 1) setGeoPermission("denied");
        const msg =
          err?.code === 1
            ? "Location permission is blocked. Enable Location for this site/app in your browser/device settings."
            : err?.code === 2
              ? "Location unavailable. Check GPS settings and try again."
              : err?.code === 3
                ? "Location request timed out. Try again in an area with better signal."
                : "Could not access location. Enable Location Services to share live GPS.";
        toast({ title: "Live GPS off", description: msg, variant: "destructive" });
      },
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 15_000 },
    );
  }, [hasGeo, sendLocation]);

  // Live GPS tracking (best-effort). Runs only on touch devices while the dispatch view is open.
  React.useEffect(() => {
    if (!user?.id || !profile?.company_id || !technicianId) return;

    if (!isTouch) return;
    if (!hasGeo) return;
    const shouldStart = gpsStartRequested || geoPermission === "granted";
    if (!shouldStart) return;

    let cancelled = false;
    let watchId: number | null = null;

    const onGeoError = (err?: GeolocationPositionError) => {
      if (geoErrorShownRef.current) return;
      geoErrorShownRef.current = true;
      const msg =
        err?.code === 1
          ? "Location permission is blocked. Enable Location for this site/app to share live GPS."
          : err?.code === 2
            ? "Location unavailable. Check GPS settings and try again."
            : err?.code === 3
              ? "Location request timed out. Try again in an area with better signal."
              : "Could not access location. Enable Location Services to share live GPS.";
      toast({ title: "Live GPS off", description: msg, variant: "destructive" });
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => { void sendLocation(pos); },
      (err) => { onGeoError(err); },
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 15_000 },
    );

    watchId = navigator.geolocation.watchPosition(
      (pos) => { void sendLocation(pos); },
      (err) => { onGeoError(err); },
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 15_000 },
    );

    return () => {
      cancelled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [geoPermission, gpsStartRequested, hasGeo, isTouch, profile?.company_id, sendLocation, technicianId, user?.id]);

  const updateStatus = async (jobId: string, status: string) => {
    const { error } = await supabase
      .from("job_cards")
      .update({ status: status as any })
      .eq("id", jobId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status, updated_at: new Date().toISOString() } : j)),
    );
    toast({ title: `Job ${status === "in-progress" ? "started" : "updated"}` });
  };

  const todayJobs = jobs.filter((j) => isToday(j.scheduled_at) && !["completed", "invoiced", "cancelled"].includes(j.status));
  const completedJobs = jobs.filter((j) => j.status === "completed" || j.status === "invoiced");
  const pendingSignatures = jobs.filter((j) => j.status === "completed");
  const activeJobs = jobs.filter((j) => ["new", "scheduled", "in-progress"].includes(j.status));
  const emergencyJobs = todayJobs.filter((j) => j.priority === "urgent" || j.priority === "emergency");
  const awaitingParts = jobs.filter((j) => j.notes?.toLowerCase().includes("awaiting parts"));
  const callbackJobs = jobs.filter((j) => j.notes?.toLowerCase().includes("callback") || j.notes?.toLowerCase().includes("return"));

  // Time logged today (from time entries)
  const inProgressJobs = jobs.filter((j) => j.status === "in-progress");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome, {profile?.full_name || "Technician"}
        </h1>
        <p className="text-muted-foreground text-sm">Your dispatch board for today.</p>
      </div>

      {!loading && isTouch && hasGeo && geoPermission !== "granted" ? (
        <Card className="bg-card/70 backdrop-blur-sm border-amber-200/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Navigation className="h-4 w-4" />
              Enable live GPS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Your admin can only see your distance to the site and “Arrived” when Location is allowed.
            </div>
            {geoPermission === "denied" ? (
              <div className="text-xs text-muted-foreground">
                Location is blocked. Enable it in your browser/device settings, then tap Retry.
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={requestGps} disabled={gpsRequesting}>
                {gpsRequesting ? "Requesting..." : geoPermission === "denied" ? "Retry" : "Enable GPS"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast({ title: "Tip", description: "Keep this dispatch screen open while traveling so GPS can update.", })}
              >
                Why?
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading && isTouch && hasGeo && geoPermission === "granted" ? (
        <div className="text-xs text-muted-foreground">
          Live GPS is on{lastSentAtMs ? ` · last sent ${formatDistanceToNowStrict(new Date(lastSentAtMs))} ago` : ""}.
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card className="bg-card/70 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" /> Jobs Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todayJobs.length}</div>
              </CardContent>
            </Card>

            <Card className="bg-card/70 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Play className="h-3.5 w-3.5" /> In Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inProgressJobs.length}</div>
              </CardContent>
            </Card>

            <Card className="bg-card/70 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completedJobs.length}</div>
              </CardContent>
            </Card>

            <Card className="bg-card/70 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <FileSignature className="h-3.5 w-3.5" /> Pending Signatures
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{pendingSignatures.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Emergency / Alerts strip */}
          {(emergencyJobs.length > 0 || callbackJobs.length > 0) && (
            <div className="flex flex-wrap gap-3">
              {emergencyJobs.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-destructive bg-destructive/10 rounded-md px-3 py-1.5">
                  <Flame className="h-3.5 w-3.5" /> {emergencyJobs.length} emergency job{emergencyJobs.length > 1 ? "s" : ""}
                </div>
              )}
              {callbackJobs.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-500/10 rounded-md px-3 py-1.5">
                  <RefreshCcw className="h-3.5 w-3.5" /> {callbackJobs.length} callback{callbackJobs.length > 1 ? "s" : ""}
                </div>
              )}
              {awaitingParts.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted rounded-md px-3 py-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> {awaitingParts.length} awaiting parts
                </div>
              )}
            </div>
          )}

          {/* Today's Jobs */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Today's Jobs</h2>
            {todayJobs.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Navigation className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <div className="font-medium">No jobs scheduled for today</div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {todayJobs.map((job) => (
                  <JobCard key={job.id} job={job} statusColor={statusColor} priorityColor={priorityColor} onStatusChange={updateStatus} />
                ))}
              </div>
            )}
          </div>

          {/* Upcoming */}
          {activeJobs.filter((j) => !isToday(j.scheduled_at)).length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Upcoming Jobs</h2>
              <div className="space-y-3">
                {activeJobs
                  .filter((j) => !isToday(j.scheduled_at))
                  .map((job) => (
                    <Card key={job.id}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{job.title}</span>
                              <Badge variant="outline" className="text-[10px]">{job.status}</Badge>
                              {(job.priority === "urgent" || job.priority === "emergency") && (
                                <Badge className={priorityColor[job.priority]}>{job.priority}</Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {job.scheduled_at && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(job.scheduled_at).toLocaleDateString()}
                                </span>
                              )}
                              {job.sites?.name && (
                                <span className="flex items-center gap-1 min-w-0">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{job.sites.name}</span>
                                </span>
                              )}
                            </div>
                          </div>
                          {(job.status === "new" || job.status === "scheduled") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(job.id, "in-progress")}
                              className="gap-1 shrink-0"
                            >
                              <Play className="h-3.5 w-3.5" />
                              Start
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completedJobs.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Completed Jobs</h2>
              <div className="space-y-2">
                {completedJobs.slice(0, 5).map((job) => (
                  <Link key={job.id} to={`/tech/job/${job.id}`} className="block">
                    <Card className="opacity-75 hover:opacity-100 transition-opacity">
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium">{job.title}</span>
                          </div>
                          <Badge className={statusColor[job.status] ?? ""} variant="secondary">
                            {job.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
                {completedJobs.length > 5 && (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    +{completedJobs.length - 5} more completed jobs
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Job Card sub-component ─── */
function JobCard({
  job,
  statusColor,
  priorityColor,
  onStatusChange,
}: {
  job: any;
  statusColor: Record<string, string>;
  priorityColor: Record<string, string>;
  onStatusChange: (id: string, status: string) => void;
}) {
  const customer = job.customers;
  const site = job.sites;

  return (
    <Link to={`/tech/job/${job.id}`} className="block">
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              {/* Title + badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{job.title}</span>
                <Badge className={statusColor[job.status] ?? ""}>{job.status}</Badge>
                {(job.priority === "urgent" || job.priority === "emergency" || job.priority === "high") && (
                  <Badge className={priorityColor[job.priority] ?? ""}>{job.priority}</Badge>
                )}
              </div>

              {/* Description */}
              {job.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
              )}

              {/* Client & contact details */}
              {customer && (
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> {customer.name}
                  </span>
                  {customer.phone && (
                    <a
                      href={`tel:${customer.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <Phone className="h-3 w-3" /> {customer.phone}
                    </a>
                  )}
                  {customer.address && (
                    <span className="flex items-center gap-1 min-w-0">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{customer.address}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Site & schedule */}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {site?.name && (
                  <span className="flex items-center gap-1 min-w-0">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {site.name}
                      {site.address && ` · ${site.address}`}
                    </span>
                  </span>
                )}
                {job.scheduled_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(job.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                {job.trade_id && (
                  <Badge variant="outline" className="text-[10px]">{job.trade_id}</Badge>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {job.status === "new" || job.status === "scheduled" ? (
                <Button
                  size="sm"
                  onClick={(e) => { e.preventDefault(); onStatusChange(job.id, "in-progress"); }}
                  className="gradient-bg hover:opacity-90 shadow-glow gap-1"
                >
                  <Play className="h-3.5 w-3.5" />
                  Start
                </Button>
              ) : job.status === "in-progress" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => { e.preventDefault(); onStatusChange(job.id, "completed"); }}
                  className="gap-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Complete
                </Button>
              ) : null}
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
