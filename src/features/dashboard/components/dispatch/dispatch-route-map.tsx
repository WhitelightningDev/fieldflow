import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { icon as leafletIcon } from "leaflet";
import { getLatLngFromAny, distanceMeters, formatDistance } from "@/lib/geo";
import { MapPin, Navigation, Clock } from "lucide-react";
import * as React from "react";
import "leaflet/dist/leaflet.css";

type Props = {
  jobs: Tables<"job_cards">[];
  technicians: Tables<"technicians">[];
  techLocations: Tables<"technician_locations">[];
  sitesById: Map<string, Tables<"sites">>;
  customersById: Map<string, Tables<"customers">>;
};

const TECH_ICON = leafletIcon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const SITE_ICON = leafletIcon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Rough travel time estimate: 40km/h average for field service
function estimateTravelMinutes(distM: number): number {
  return Math.round((distM / 1000) / 40 * 60);
}

export default function DispatchRouteMap({ jobs, technicians, techLocations, sitesById, customersById }: Props) {
  const techLocMap = React.useMemo(() => {
    const m = new Map<string, Tables<"technician_locations">>();
    for (const loc of techLocations) {
      m.set(loc.technician_id, loc);
    }
    return m;
  }, [techLocations]);

  const activeJobs = React.useMemo(
    () => jobs.filter((j) => ["new", "scheduled", "in-progress"].includes(j.status)),
    [jobs],
  );

  // Collect all markers
  const markers = React.useMemo(() => {
    const techMarkers: Array<{ type: "tech"; id: string; name: string; lat: number; lng: number }> = [];
    const siteMarkers: Array<{ type: "site"; id: string; name: string; lat: number; lng: number; jobs: Tables<"job_cards">[] }> = [];

    for (const tech of technicians.filter((t) => t.active)) {
      const loc = techLocMap.get(tech.id);
      const coords = getLatLngFromAny(loc);
      if (coords) {
        techMarkers.push({ type: "tech", id: tech.id, name: tech.name, lat: coords.lat, lng: coords.lng });
      }
    }

    const sitesWithJobs = new Map<string, Tables<"job_cards">[]>();
    for (const job of activeJobs) {
      if (!job.site_id) continue;
      const arr = sitesWithJobs.get(job.site_id) ?? [];
      arr.push(job);
      sitesWithJobs.set(job.site_id, arr);
    }

    for (const [siteId, siteJobs] of sitesWithJobs) {
      const site = sitesById.get(siteId);
      if (!site) continue;
      const coords = getLatLngFromAny(site);
      if (coords) {
        siteMarkers.push({ type: "site", id: siteId, name: site.name, lat: coords.lat, lng: coords.lng, jobs: siteJobs });
      }
    }

    return { techMarkers, siteMarkers };
  }, [technicians, techLocMap, activeJobs, sitesById]);

  // Build route lines from tech → assigned job sites
  const routeLines = React.useMemo(() => {
    const lines: Array<{ techName: string; from: [number, number]; to: [number, number]; distM: number; travelMin: number }> = [];

    for (const tech of markers.techMarkers) {
      const techJobs = activeJobs.filter((j) => j.technician_id === tech.id && j.site_id);
      const visitedSites = new Set<string>();
      for (const job of techJobs) {
        if (!job.site_id || visitedSites.has(job.site_id)) continue;
        visitedSites.add(job.site_id);
        const siteMarker = markers.siteMarkers.find((s) => s.id === job.site_id);
        if (!siteMarker) continue;
        const distM = distanceMeters({ lat: tech.lat, lng: tech.lng }, { lat: siteMarker.lat, lng: siteMarker.lng });
        lines.push({
          techName: tech.name,
          from: [tech.lat, tech.lng],
          to: [siteMarker.lat, siteMarker.lng],
          distM,
          travelMin: estimateTravelMinutes(distM),
        });
      }
    }

    return lines;
  }, [markers, activeJobs]);

  // Calculate center
  const center = React.useMemo<[number, number]>(() => {
    const allPoints = [
      ...markers.techMarkers.map((m) => [m.lat, m.lng] as [number, number]),
      ...markers.siteMarkers.map((m) => [m.lat, m.lng] as [number, number]),
    ];
    if (allPoints.length === 0) return [-26.2041, 28.0473]; // Default: Johannesburg
    const avgLat = allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length;
    const avgLng = allPoints.reduce((s, p) => s + p[1], 0) / allPoints.length;
    return [avgLat, avgLng];
  }, [markers]);

  const hasData = markers.techMarkers.length > 0 || markers.siteMarkers.length > 0;

  return (
    <Card className="bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Navigation className="h-4 w-4" />
            Route map
          </CardTitle>
          {routeLines.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {routeLines.length} route{routeLines.length === 1 ? "" : "s"}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="rounded-lg border border-dashed bg-muted/30 py-12 text-center text-muted-foreground text-sm">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No GPS data or geo-tagged sites yet. Enable technician GPS and add coordinates to your sites.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg overflow-hidden border" style={{ height: 400 }}>
              <MapContainer center={center} zoom={10} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {markers.techMarkers.map((m) => (
                  <Marker key={`tech-${m.id}`} position={[m.lat, m.lng]} icon={TECH_ICON}>
                    <Popup>
                      <strong>{m.name}</strong><br />
                      <span className="text-xs">Technician (live location)</span>
                    </Popup>
                  </Marker>
                ))}

                {markers.siteMarkers.map((m) => (
                  <Marker key={`site-${m.id}`} position={[m.lat, m.lng]} icon={SITE_ICON}>
                    <Popup>
                      <strong>{m.name}</strong><br />
                      <span className="text-xs">{m.jobs.length} active job{m.jobs.length === 1 ? "" : "s"}</span>
                      {m.jobs.map((j) => (
                        <div key={j.id} className="text-xs mt-1">• {j.title}</div>
                      ))}
                    </Popup>
                  </Marker>
                ))}

                {routeLines.map((r, i) => (
                  <Polyline key={i} positions={[r.from, r.to]} color="hsl(var(--primary))" weight={2} dashArray="6 4" opacity={0.7} />
                ))}
              </MapContainer>
            </div>

            {/* Travel estimates */}
            {routeLines.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Estimated travel</div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {routeLines.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-xs">
                      <span className="font-medium">{r.techName}</span>
                      <span className="text-muted-foreground">
                        {formatDistance(r.distM)} · ~{r.travelMin} min
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">🔵 Technician</span>
              <span className="flex items-center gap-1">🔴 Job site</span>
              <span className="flex items-center gap-1">--- Route (est. 40km/h avg)</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
