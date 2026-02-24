import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Globe, Phone, Upload, X } from "lucide-react";
import * as React from "react";

function toCents(v: string) {
  const n = Number.parseFloat((v ?? "").trim());
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n * 100));
}

function numOr(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export default function DashboardSettings() {
  const { data, actions } = useDashboardData();
  const company = data.company as any;

  // Finance
  const [calloutFee, setCalloutFee] = React.useState("");
  const [calloutRadiusKm, setCalloutRadiusKm] = React.useState("50");
  const [labourOverheadPercent, setLabourOverheadPercent] = React.useState("15");
  const [savingFinance, setSavingFinance] = React.useState(false);

  // Profile
  const [phone, setPhone] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [vatNumber, setVatNumber] = React.useState("");
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!company) return;
    // Supabase returns Postgres `numeric` fields as strings.
    const fee = numOr(company.callout_fee_cents, 0);
    const radius = numOr(company.callout_radius_km, 50);
    const overhead = numOr(company.labour_overhead_percent, 15);
    setCalloutFee((fee / 100).toFixed(2));
    setCalloutRadiusKm(String(radius));
    setLabourOverheadPercent(String(overhead));
    setPhone(company.phone ?? "");
    setWebsite(company.website ?? "");
    setAddress(company.address ?? "");
    setVatNumber(company.vat_number ?? "");
    setLogoPreview(company.logo_url ?? null);
  }, [
    company?.id,
    company?.callout_fee_cents,
    company?.callout_radius_km,
    company?.labour_overhead_percent,
    company?.phone,
    company?.website,
    company?.address,
    company?.vat_number,
    company?.logo_url,
  ]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const saveFinance = async () => {
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

    setSavingFinance(true);
    const { error } = await supabase
      .from("companies")
      .update({
        callout_fee_cents: String(feeCents),
        callout_radius_km: String(radius),
        labour_overhead_percent: String(overhead),
      } as any)
      .eq("id", company.id);
    setSavingFinance(false);

    if (error) {
      toast({ title: "Could not save settings", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Finance settings saved" });
    await actions.refreshData();
  };

  const saveProfile = async () => {
    if (!company?.id) return;
    setSavingProfile(true);

    let logoUrl: string | null = company.logo_url ?? null;

    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `${company.id}/logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("company-logos")
        .upload(path, logoFile, { upsert: true });
      if (upErr) {
        toast({ title: "Logo upload failed", description: upErr.message, variant: "destructive" });
        setSavingProfile(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("company-logos").getPublicUrl(path);
      logoUrl = urlData.publicUrl;
    }

    const { error } = await supabase
      .from("companies")
      .update({
        phone: phone || null,
        website: website || null,
        address: address || null,
        vat_number: vatNumber || null,
        logo_url: logoUrl,
        profile_complete: true,
      } as any)
      .eq("id", company.id);

    setSavingProfile(false);

    if (error) {
      toast({ title: "Could not save profile", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Company profile saved" });
    await actions.refreshData();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage your company profile, branding, and finance configuration." />

      {/* Company Profile */}
      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Company profile
          </CardTitle>
          <CardDescription>
            This information appears on invoices, certificates, and throughout your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Logo */}
          <div className="space-y-2">
            <Label>Company logo</Label>
            <div className="flex items-center gap-4">
              <div
                onClick={() => fileRef.current?.click()}
                className="relative h-20 w-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/60 hover:bg-secondary/30 transition-colors overflow-hidden"
                style={logoPreview ? { borderStyle: "solid" } : {}}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-1" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Upload className="h-5 w-5" />
                    <span className="text-[10px]">Upload</span>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  {logoPreview ? "Change logo" : "Upload logo"}
                </Button>
                {logoPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive ml-2"
                    onClick={() => { setLogoPreview(null); setLogoFile(null); }}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">PNG or JPG, max 2 MB. Appears in your sidebar and on invoices.</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleLogoChange}
              />
            </div>
          </div>

          {/* Contact details */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-phone" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                Phone number
              </Label>
              <Input id="s-phone" placeholder="+27 11 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-website" className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                Website
              </Label>
              <Input id="s-website" placeholder="https://yourcompany.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-address">Business address</Label>
              <Input id="s-address" placeholder="123 Main St, Sandton" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-vat">VAT number</Label>
              <Input id="s-vat" placeholder="4123456789" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={savingProfile || !company?.id} className="gradient-bg hover:opacity-90 shadow-glow">
              {savingProfile ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Finance settings */}
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
            <Button onClick={saveFinance} disabled={savingFinance || !company?.id} className="gradient-bg hover:opacity-90 shadow-glow">
              {savingFinance ? "Saving..." : "Save finance settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
