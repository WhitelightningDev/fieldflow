import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";
import * as React from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

type LatLng = { lat: number; lng: number };

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

function toNum(v: unknown) {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
}

function clampLatLng(v: LatLng): LatLng {
  return {
    lat: Math.max(-90, Math.min(90, v.lat)),
    lng: Math.max(-180, Math.min(180, v.lng)),
  };
}

function Recenter({ center }: { center: LatLng }) {
  const map = useMap();
  React.useEffect(() => {
    const c = clampLatLng(center);
    map.setView([c.lat, c.lng], map.getZoom(), { animate: true });
  }, [center.lat, center.lng, map]);
  return null;
}

function ClickToPick({ onPick }: { onPick: (v: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

type Props = {
  trigger: React.ReactNode;
  title?: string;
  description?: string;
  initialQuery?: string;
  initialCenter?: LatLng | null;
  onConfirm: (v: LatLng) => void;
};

export default function LatLngPickerDialog({
  trigger,
  title = "Pick GPS location",
  description = "Search for the site, then tap the exact spot on the map to capture latitude/longitude.",
  initialQuery,
  initialCenter,
  onConfirm,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(initialQuery ?? "");
  const [results, setResults] = React.useState<NominatimResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchErr, setSearchErr] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<LatLng | null>(null);
  const [center, setCenter] = React.useState<LatLng>(() => initialCenter ?? { lat: -26.2041, lng: 28.0473 });

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) return;

    setQuery(initialQuery ?? "");
    setSearchErr(null);
    setSearching(false);
    setResults([]);

    const initial = selected ?? initialCenter ?? null;
    if (initial) setCenter(clampLatLng(initial));
    if (!selected && initialCenter) setSelected(clampLatLng(initialCenter));
  }, [initialCenter, initialQuery, selected]);

  const runSearch = React.useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchErr(null);
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "json");
      url.searchParams.set("q", q);
      url.searchParams.set("limit", "6");
      url.searchParams.set("addressdetails", "1");

      const res = await fetch(url.toString(), { method: "GET" });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const json = (await res.json()) as NominatimResult[];
      setResults(Array.isArray(json) ? json : []);
    } catch (e) {
      setSearchErr(e instanceof Error ? e.message : "Search failed");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const useMyLocation = React.useCallback(async () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next = clampLatLng({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setSelected(next);
          setCenter(next);
          resolve();
        },
        () => resolve(),
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 30_000 },
      );
    });
  }, []);

  const canConfirm = Boolean(selected);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search address / place name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runSearch();
                }
              }}
            />
          </div>
          <Button type="button" variant="outline" onClick={() => void runSearch()} disabled={searching || query.trim().length === 0}>
            {searching ? "Searching…" : "Search"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => void useMyLocation()}>
            Use my location
          </Button>
        </div>

        {searchErr ? (
          <div className="text-xs text-destructive">{searchErr}</div>
        ) : null}

        {results.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {results.map((r) => {
              const lat = toNum(r.lat);
              const lng = toNum(r.lon);
              const disabled = lat == null || lng == null;
              return (
                <button
                  key={r.place_id}
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "text-left rounded-md border px-3 py-2 text-xs hover:bg-secondary/50 transition-colors",
                    disabled && "opacity-50 cursor-not-allowed",
                  )}
                  onClick={() => {
                    if (lat == null || lng == null) return;
                    const next = clampLatLng({ lat, lng });
                    setSelected(next);
                    setCenter(next);
                  }}
                >
                  <div className="font-medium line-clamp-2">{r.display_name}</div>
                  {lat != null && lng != null ? (
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {lat.toFixed(5)}, {lng.toFixed(5)}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Tip: Search, then tap the exact spot on the map to set the pin.
          </div>
        )}

        <div className="h-[55vh] w-full rounded-lg overflow-hidden border">
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={15}
            scrollWheelZoom
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickToPick
              onPick={(v) => {
                const next = clampLatLng(v);
                setSelected(next);
                setCenter(next);
              }}
            />
            <Recenter center={center} />
            {selected ? (
              <CircleMarker center={[selected.lat, selected.lng]} radius={8} pathOptions={{ color: "#2563eb" }} />
            ) : null}
          </MapContainer>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="text-muted-foreground">
            {selected ? (
              <>
                Selected: <span className="font-medium text-foreground">{selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}</span>
              </>
            ) : (
              "No location selected yet."
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setSelected(null)}
            disabled={!selected}
          >
            Clear
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="gradient-bg hover:opacity-90 shadow-glow"
            disabled={!canConfirm}
            onClick={() => {
              if (!selected) return;
              onConfirm(selected);
              setOpen(false);
            }}
          >
            Use this location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
