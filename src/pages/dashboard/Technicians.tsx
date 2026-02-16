import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TRADES } from "@/features/company-signup/content/trades";
import CreateTechnicianDialog from "@/features/dashboard/components/dialogs/create-technician-dialog";
import DeleteTechnicianAlertDialog from "@/features/dashboard/components/dialogs/delete-technician-alert-dialog";
import EditTechnicianDialog from "@/features/dashboard/components/dialogs/edit-technician-dialog";
import EditTechnicianRatesDialog from "@/features/dashboard/components/dialogs/edit-technician-rates-dialog";
import SetTechnicianAccessDialog from "@/features/dashboard/components/dialogs/set-technician-access-dialog";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { formatZarFromCents } from "@/lib/money";
import { MapPin } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

export default function Technicians() {
  const { data } = useDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader title="Technicians" subtitle="Add technicians and assign trades for dispatching." actions={<CreateTechnicianDialog />} />

      <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
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
            {data.technicians.map((t) => (
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
                  {(() => {
                    const jobs = data.jobCards.filter((j: any) => j.technician_id === t.id);
                    const inProgress = jobs.find((j: any) => j.status === "in-progress") ?? null;
                    const scheduled = jobs.find((j: any) => j.status === "scheduled") ?? null;
                    const current = inProgress ?? scheduled;
                    const site = current?.site_id ? data.sites.find((s) => s.id === current.site_id) : null;
                    const loc = (data.technicianLocations as any[]).find((l) => l.technician_id === t.id) ?? null;
                    const last = (loc?.updated_at ?? loc?.recorded_at) as string | undefined;
                    const lastMs = last ? new Date(last).getTime() : null;
                    const isLive = lastMs != null && Date.now() - lastMs < 2 * 60 * 1000;
                    const statusLabel = inProgress ? "On job" : scheduled ? "Scheduled" : "Idle";
                    const dotClass = inProgress ? "bg-emerald-500" : scheduled ? "bg-blue-500" : isLive ? "bg-amber-500" : "bg-muted";

                    return (
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {current?.title ?? (site?.name ? "Assigned" : "—")}
                            </div>
                            <div className="text-[11px] text-muted-foreground">{statusLabel}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 min-w-0">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{site?.name ?? site?.address ?? "No site"}</span>
                            </div>
                          </div>
                        </div>
                        {loc?.lat != null && loc?.lng != null ? (
                          <div className="flex items-center gap-2">
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                            >
                              <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer">
                                Map
                              </a>
                            </Button>
                            {last ? <span className="text-[11px] text-muted-foreground">Updated {formatDistanceToNowStrict(new Date(last))} ago</span> : null}
                          </div>
                        ) : (
                          last ? <div className="text-[11px] text-muted-foreground">Updated {formatDistanceToNowStrict(new Date(last))} ago</div> : null
                        )}
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {typeof (t as any).hourly_cost_cents === "number" ? `${formatZarFromCents((t as any).hourly_cost_cents)}/hr` : "—"}
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
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
