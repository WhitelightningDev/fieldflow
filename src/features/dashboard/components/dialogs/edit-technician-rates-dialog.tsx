import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { formatUsdFromCents } from "@/lib/money";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import * as React from "react";

function parseMoneyToCents(value: string) {
  const v = value.trim();
  if (!v) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return NaN;
  return Math.round(Number.parseFloat(v) * 100);
}

export default function EditTechnicianRatesDialog({ technicianId }: { technicianId: string }) {
  const { data, actions } = useDashboardData();
  const technician: any = data.technicians.find((t) => t.id === technicianId) ?? null;

  const [open, setOpen] = React.useState(false);
  const [hourlyCost, setHourlyCost] = React.useState("");
  const [hourlyBill, setHourlyBill] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open || !technician) return;
    setHourlyCost(typeof technician.hourly_cost_cents === "number" ? (technician.hourly_cost_cents / 100).toFixed(2) : "");
    setHourlyBill(typeof technician.hourly_bill_rate_cents === "number" ? (technician.hourly_bill_rate_cents / 100).toFixed(2) : "");
  }, [open, technician]);

  if (!technician) return null;

  const save = async () => {
    const hourlyCostCents = parseMoneyToCents(hourlyCost);
    const hourlyBillRateCents = parseMoneyToCents(hourlyBill);
    if (Number.isNaN(hourlyCostCents) || Number.isNaN(hourlyBillRateCents)) {
      toast({ title: "Invalid amount", description: "Use numbers like 45 or 45.50.", variant: "destructive" });
      return;
    }
    setSaving(true);
    await actions.setTechnicianRates(technicianId, {
      hourlyCostCents,
      hourlyBillRateCents,
    });
    setSaving(false);
    toast({ title: "Rates saved" });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Rates</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Technician rates</DialogTitle>
          <DialogDescription>
            Used for labour cost and gross margin reporting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">{technician.name}</div>
            <div className="text-xs text-muted-foreground">
              Current cost:{" "}
              {typeof technician.hourly_cost_cents === "number" ? `${formatUsdFromCents(technician.hourly_cost_cents)}/hr` : "—"}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hourly cost (USD)</Label>
              <Input inputMode="decimal" placeholder="e.g. 35.00" value={hourlyCost} onChange={(e) => setHourlyCost(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hourly bill rate (USD, optional)</Label>
              <Input inputMode="decimal" placeholder="e.g. 95.00" value={hourlyBill} onChange={(e) => setHourlyBill(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving} className="gradient-bg hover:opacity-90 shadow-glow">
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

