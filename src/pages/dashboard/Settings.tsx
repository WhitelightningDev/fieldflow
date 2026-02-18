import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { supabase } from "@/integrations/supabase/client";
import * as React from "react";

function toCents(v: string) {
  const n = Number.parseFloat((v ?? "").trim());
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n * 100));
}

export default function DashboardSettings() {
  const { data, actions } = useDashboardData();
  const company = data.company;

  const [calloutFee, setCalloutFee] = React.useState("");
  const [calloutRadiusKm, setCalloutRadiusKm] = React.useState("50");
  const [labourOverheadPercent, setLabourOverheadPercent] = React.useState("15");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!company) return;
    const fee = typeof (company as any).callout_fee_cents === "number" ? (company as any).callout_fee_cents : 0;
    const radius = typeof (company as any).callout_radius_km === "number" ? (company as any).callout_radius_km : 50;
    const overhead = typeof (company as any).labour_overhead_percent === "number" ? (company as any).labour_overhead_percent : 15;
    setCalloutFee((fee / 100).toFixed(2));
    setCalloutRadiusKm(String(radius));
    setLabourOverheadPercent(String(overhead));
  }, [company?.id]);

  const save = async () => {
    if (!company?.id) return;
    const feeCents = toCents(calloutFee);
    const radius = Number.parseInt(calloutRadiusKm, 10);
    const overhead = Number.parseFloat(labourOverheadPercent);

    if (feeCents === null) {
      toast({ title: "Invalid call-out fee", description: "Enter a valid amount like 450 or 450.00", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(radius) || radius <= 0 || radius > 10000) {
      toast({ title: "Invalid radius", description: "Enter a radius in km (e.g. 50).", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(overhead) || overhead < 0 || overhead > 300) {
      toast({ title: "Invalid overhead", description: "Enter a percent (0–300).", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({ callout_fee_cents: feeCents, callout_radius_km: radius, labour_overhead_percent: overhead } as any)
      .eq("id", company.id);
    setSaving(false);

    if (error) {
      toast({ title: "Could not save settings", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Settings saved" });
    await actions.refreshData();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Company finance settings used for invoicing and profitability." />

      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Finance</CardTitle>
          <CardDescription>
            Call-out fee is shown to the customer on invoices. Labour overhead affects internal cost-to-company calculations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <div className="text-sm font-medium">Call-out fee (R)</div>
              <Input inputMode="decimal" value={calloutFee} onChange={(e) => setCalloutFee(e.target.value)} placeholder="e.g. 450.00" />
            </div>
            <div className="space-y-1.5">
              <div className="text-sm font-medium">Included travel radius (km)</div>
              <Input inputMode="numeric" value={calloutRadiusKm} onChange={(e) => setCalloutRadiusKm(e.target.value)} placeholder="50" />
            </div>
            <div className="space-y-1.5">
              <div className="text-sm font-medium">Labour overhead (%)</div>
              <Input inputMode="decimal" value={labourOverheadPercent} onChange={(e) => setLabourOverheadPercent(e.target.value)} placeholder="15" />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving || !company?.id} className="gradient-bg hover:opacity-90 shadow-glow">
              {saving ? "Saving..." : "Save settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

