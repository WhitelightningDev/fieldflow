import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { EmptyStateCard } from "@/components/ui/empty-state-card";
import { toast } from "@/components/ui/use-toast";
import { AlertTriangle, MapPin, Search, Zap, ZapOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import {
  useNationalStatus,
  useAreaSchedule,
  useLoadsheddingConfig,
  isJobDuringOutage,
} from "@/features/loadshedding/hooks/use-loadshedding";
import { loadshedding, type EspAreaSearchResult } from "@/features/loadshedding/lib/loadshedding-api";
import PageHeader from "@/features/dashboard/components/page-header";
import { Link } from "react-router-dom";

function parseStage(raw: string | undefined): number {
  if (!raw) return 0;
  const match = raw.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export default function LoadShedding() {
  const { profile } = useAuth();
  const { data } = useDashboardData();
  const companyId = profile?.company_id;

  const { status, loading: statusLoading } = useNationalStatus();
  const { config, loading: configLoading, refresh: refreshConfig } = useLoadsheddingConfig(companyId);
  const { schedule, loading: scheduleLoading } = useAreaSchedule(config?.area_id);

  // Area search
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<EspAreaSearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const result = await loadshedding.search(searchQuery.trim());
      setSearchResults(result.areas ?? []);
    } catch (e: any) {
      toast({ title: "Search failed", description: e.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const selectArea = async (area: EspAreaSearchResult) => {
    if (!companyId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("company_loadshedding_config" as any)
        .upsert({
          company_id: companyId,
          area_id: area.id,
          area_name: area.name,
          region: area.region,
        } as any, { onConflict: "company_id" });
      if (error) throw error;
      toast({ title: "Area saved", description: area.name });
      setSearchResults([]);
      setSearchQuery("");
      await refreshConfig();
    } catch (e: any) {
      toast({ title: "Failed to save area", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Affected jobs
  const affectedJobs = React.useMemo(() => {
    if (!schedule?.events || !data.jobCards) return [];
    return data.jobCards.filter(
      (j: any) =>
        j.requires_power &&
        !["completed", "cancelled", "invoiced"].includes(j.status) &&
        isJobDuringOutage(j.scheduled_at, schedule.events),
    );
  }, [data.jobCards, schedule]);

  const eskomStage = parseStage(status?.status?.eskom?.stage);
  const cptStage = parseStage(status?.status?.capetown?.stage);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Load Shedding"
        subtitle="Monitor Eskom schedules and manage power-dependent jobs."
      />

      {/* National status */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <Card className="shadow-sm border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Eskom National</CardTitle>
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <Spinner />
            ) : (
              <div className="flex items-center gap-2">
                {eskomStage > 0 ? (
                  <ZapOff className="h-5 w-5 text-destructive" />
                ) : (
                  <Zap className="h-5 w-5 text-emerald-500" />
                )}
                <span className="text-lg font-bold">
                  {eskomStage === 0 ? "No load shedding" : `Stage ${eskomStage}`}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cape Town</CardTitle>
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <Spinner />
            ) : (
              <div className="flex items-center gap-2">
                {cptStage > 0 ? (
                  <ZapOff className="h-5 w-5 text-destructive" />
                ) : (
                  <Zap className="h-5 w-5 text-emerald-500" />
                )}
                <span className="text-lg font-bold">
                  {cptStage === 0 ? "No load shedding" : `Stage ${cptStage}`}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Area configuration */}
      <Card className="shadow-sm border-border/40">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Your Area
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {config ? (
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-medium">{config.area_name}</div>
                {config.region && <div className="text-xs text-muted-foreground">{config.region}</div>}
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
              }}>
                Change area
              </Button>
            </div>
          ) : configLoading ? (
            <Spinner />
          ) : null}

          <div className="flex gap-2">
            <Input
              placeholder="Search your area (e.g. Sandton, Durbanville)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()} size="sm">
              {searching ? <Spinner /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {searchResults.map((area) => (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => selectArea(area)}
                  disabled={saving}
                  className="flex w-full items-center gap-3 rounded-lg border border-border/50 bg-card p-3 text-left transition-all hover:bg-accent/30"
                >
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{area.name}</div>
                    <div className="text-xs text-muted-foreground">{area.region}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule */}
      {config && (
        <Card className="shadow-sm border-border/40">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Upcoming Outages — {config.area_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scheduleLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : schedule?.events && schedule.events.length > 0 ? (
              <div className="space-y-2">
                {schedule.events
                  .filter((e) => new Date(e.end).getTime() > Date.now())
                  .slice(0, 10)
                  .map((e, i) => {
                    const start = new Date(e.start);
                    const end = new Date(e.end);
                    const isNow = Date.now() >= start.getTime() && Date.now() <= end.getTime();
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                          isNow ? "border-destructive/50 bg-destructive/5" : "border-border/40"
                        }`}
                      >
                        <ZapOff className={`h-4 w-4 shrink-0 ${isNow ? "text-destructive" : "text-muted-foreground"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">
                            {start.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {start.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                            {" – "}
                            {end.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                        {isNow && <Badge variant="destructive" className="text-[10px]">Active now</Badge>}
                        {e.note && <span className="text-xs text-muted-foreground hidden sm:block">{e.note}</span>}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <EmptyStateCard icon={<Zap className="h-10 w-10" />} title="No upcoming outages scheduled" />
            )}
          </CardContent>
        </Card>
      )}

      {/* Affected jobs */}
      {affectedJobs.length > 0 && (
        <Card className="shadow-sm border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {affectedJobs.length} Job{affectedJobs.length > 1 ? "s" : ""} Affected by Outages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(affectedJobs as any[]).map((job) => (
              <Link
                key={job.id}
                to="/dashboard/jobs"
                className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-card px-3 py-2 text-sm hover:shadow-sm transition-shadow"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{job.title}</div>
                  {job.scheduled_at && (
                    <div className="text-xs text-muted-foreground">
                      Scheduled: {new Date(job.scheduled_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                  )}
                </div>
                <Badge variant="destructive" className="text-[10px] shrink-0">⚡ Outage</Badge>
              </Link>
            ))}
            <p className="text-xs text-muted-foreground mt-2">
              Consider rescheduling these power-dependent jobs outside of outage windows.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
