import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TRADES } from "@/features/company-signup/content/trades";
import CreateTechnicianDialog from "@/features/dashboard/components/dialogs/create-technician-dialog";
import DeleteTechnicianAlertDialog from "@/features/dashboard/components/dialogs/delete-technician-alert-dialog";
import EditTechnicianDialog from "@/features/dashboard/components/dialogs/edit-technician-dialog";
import EditTechnicianRatesDialog from "@/features/dashboard/components/dialogs/edit-technician-rates-dialog";
import SetTechnicianAccessDialog from "@/features/dashboard/components/dialogs/set-technician-access-dialog";
import JobStatusBadge from "@/features/dashboard/components/job-status-badge";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { distanceMeters, formatDistance, getLatLngFromAny, isArrived } from "@/lib/geo";
import { formatZarFromCents } from "@/lib/money";
import { formatDistanceToNowStrict } from "date-fns";
import { MapPin } from "lucide-react";

function getTechWhere(data: any, technicianId: string) {
  const jobs = ((data.jobCards as any[]) ?? []).filter((j: any) => j.technician_id === technicianId);
  const inProgress = jobs.find((j: any) => j.status === "in-progress") ?? null;
  const scheduled = jobs.find((j: any) => j.status === "scheduled") ?? null;
  const loc = ((data.technicianLocations as any[]) ?? []).find((l) => l.technician_id === technicianId) ?? null;

  const locJobId = (loc as any)?.job_card_id as string | null | undefined;
  const locJob = locJobId ? ((data.jobCards as any[]) ?? []).find((j) => j.id === locJobId) ?? null : null;
  const current = locJob ?? inProgress ?? scheduled;
  const site = current?.site_id ? ((data.sites as any[]) ?? []).find((s) => s.id === current.site_id) : null;

  const last = (loc?.updated_at ?? loc?.recorded_at) as string | undefined;
  const lastMs = last ? new Date(last).getTime() : null;
  const isLive = lastMs != null && Date.now() - lastMs < 2 * 60 * 1000;

  const currentStatus = (current as any)?.status as string | undefined;
  const statusLabel =
    currentStatus === "in-progress"
      ? "On job"
      : currentStatus === "scheduled"
        ? "Scheduled"
        : current
          ? "Assigned"
          : "Idle";
  const dotClass =
    currentStatus === "in-progress"
      ? "bg-emerald-500"
      : currentStatus === "scheduled"
        ? "bg-blue-500"
        : isLive
          ? "bg-amber-500"
          : "bg-muted";

  const techCoords = getLatLngFromAny(loc);
  const siteCoords = getLatLngFromAny(site);
  const distM = techCoords && siteCoords ? distanceMeters(techCoords, siteCoords) : null;
  const arrived = distM != null ? isArrived({ distanceM: distM, accuracyM: (loc as any)?.accuracy }) : false;

  const routeHref =
    techCoords && siteCoords
      ? `https://www.google.com/maps/dir/?api=1&origin=${techCoords.lat},${techCoords.lng}&destination=${siteCoords.lat},${siteCoords.lng}`
      : null;
  const mapHref = techCoords ? `https://www.google.com/maps?q=${techCoords.lat},${techCoords.lng}` : null;

  const distanceLine = site
    ? distM != null
      ? arrived
        ? "Arrived"
        : `${formatDistance(distM)} from site`
      : techCoords && !siteCoords
        ? "Site GPS not set"
        : !techCoords && siteCoords
          ? "Waiting for technician GPS"
          : "—"
    : null;

  return { current, site, last, statusLabel, dotClass, distanceLine, mapHref, routeHref };
}

export default function Technicians() {
  const { data } = useDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Technicians"
        subtitle="Add technicians and assign trades for dispatching."
        actions={<CreateTechnicianDialog />}
      />

      {/* Mobile cards */}
      <div className="grid gap-3 sm:hidden">
        {data.technicians.length === 0 ? (
          <div className="rounded-xl border bg-card/70 backdrop-blur-sm py-10 text-center text-sm text-muted-foreground">
            No technicians yet.
          </div>
        ) : null}

        {data.technicians.map((t) => {
          const where = getTechWhere(data, t.id);
          return (
            <Card key={t.id} className="bg-card/70 backdrop-blur-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{t.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {t.phone || "—"} • {t.email || "—"}
                    </div>
                  </div>
                  {t.active ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {t.trades.map((tradeId) => (
                    <Badge key={tradeId} variant="secondary">
                      {TRADES.find((x) => x.id === tradeId)?.shortName ?? tradeId}
                    </Badge>
                  ))}
                </div>

                <div className="rounded-lg border bg-background/40 p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 rounded-full ${where.dotClass}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {where.current?.title ?? (where.site?.name ? "Assigned" : "—")}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span>{where.statusLabel}</span>
                        {where.current?.status ? <JobStatusBadge status={where.current.status as any} /> : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1 min-w-0">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{where.site?.name ?? where.site?.address ?? "No site"}</span>
                  </div>

                  {where.distanceLine ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {where.distanceLine === "Arrived" ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Arrived</span>
                      ) : (
                        <span>{where.distanceLine}</span>
                      )}
                    </div>
                  ) : null}

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-muted-foreground">
                      {where.last ? `Updated ${formatDistanceToNowStrict(new Date(where.last))} ago` : "No live GPS"}
                    </div>
                    <div className="flex items-center gap-2">
                      {where.mapHref ? (
                        <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                          <a href={where.mapHref} target="_blank" rel="noreferrer">
                            Map
                          </a>
                        </Button>
                      ) : null}
                      {where.routeHref ? (
                        <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                          <a href={where.routeHref} target="_blank" rel="noreferrer">
                            Route
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <EditTechnicianDialog technicianId={t.id} />
                  <EditTechnicianRatesDialog technicianId={t.id} />
                  <SetTechnicianAccessDialog technicianId={t.id} />
                  <DeleteTechnicianAlertDialog technicianId={t.id} />
                </div>

                <div className="text-xs text-muted-foreground text-right">
                  {typeof (t as any).hourly_cost_cents === "number"
                    ? `${formatZarFromCents((t as any).hourly_cost_cents)}/hr cost`
                    : "Cost/hr —"}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block rounded-xl border bg-card/70 backdrop-blur-sm overflow-x-auto">
        <div className="min-w-[1100px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Trades</TableHead>
                <TableHead>Where</TableHead>
                <TableHead>Cost/hr</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.technicians.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    No technicians yet.
                  </TableCell>
                </TableRow>
              ) : null}

              {data.technicians.map((t) => {
                const where = getTechWhere(data, t.id);
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.phone || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.email || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {t.trades.map((tradeId) => (
                          <Badge key={tradeId} variant="secondary">
                            {TRADES.find((x) => x.id === tradeId)?.shortName ?? tradeId}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-2 w-2 rounded-full ${where.dotClass}`} />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {where.current?.title ?? (where.site?.name ? "Assigned" : "—")}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                              <span>{where.statusLabel}</span>
                              {where.current?.status ? <JobStatusBadge status={where.current.status as any} /> : null}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 min-w-0">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{where.site?.name ?? where.site?.address ?? "No site"}</span>
                            </div>
                            {where.distanceLine ? (
                              <div className="text-xs text-muted-foreground">
                                {where.distanceLine === "Arrived" ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Arrived</span>
                                ) : (
                                  <span>{where.distanceLine}</span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        {where.mapHref ? (
                          <div className="flex items-center gap-2">
                            <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                              <a href={where.mapHref} target="_blank" rel="noreferrer">
                                Map
                              </a>
                            </Button>
                            {where.routeHref ? (
                              <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                                <a href={where.routeHref} target="_blank" rel="noreferrer">
                                  Route
                                </a>
                              </Button>
                            ) : null}
                            {where.last ? (
                              <span className="text-[11px] text-muted-foreground">
                                Updated {formatDistanceToNowStrict(new Date(where.last))} ago
                              </span>
                            ) : null}
                          </div>
                        ) : where.last ? (
                          <div className="text-[11px] text-muted-foreground">
                            Updated {formatDistanceToNowStrict(new Date(where.last))} ago
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {typeof (t as any).hourly_cost_cents === "number"
                        ? `${formatZarFromCents((t as any).hourly_cost_cents)}/hr`
                        : "—"}
                    </TableCell>
                    <TableCell>{t.active ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <EditTechnicianDialog technicianId={t.id} />
                        <EditTechnicianRatesDialog technicianId={t.id} />
                        <SetTechnicianAccessDialog technicianId={t.id} />
                        <DeleteTechnicianAlertDialog technicianId={t.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
