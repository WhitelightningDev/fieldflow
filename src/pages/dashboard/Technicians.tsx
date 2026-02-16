import { Badge } from "@/components/ui/badge";
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
              <TableHead>Cost/hr</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.technicians.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
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
