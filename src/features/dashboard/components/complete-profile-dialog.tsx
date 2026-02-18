import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { toast } from "@/components/ui/use-toast";
import { Building2, Globe, Phone, Upload, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CompleteProfileDialog({ open, onClose }: Props) {
  const { profile } = useAuth();
  const { data, actions } = useDashboardData();
  const company = data.company;

  const [phone, setPhone] = React.useState(company?.phone ?? "");
  const [website, setWebsite] = React.useState(company?.website ?? "");
  const [address, setAddress] = React.useState(company?.address ?? "");
  const [vatNumber, setVatNumber] = React.useState(company?.vat_number ?? "");
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(
    (company as any)?.logo_url ?? null,
  );
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Sync when company loads
  React.useEffect(() => {
    if (!company) return;
    setPhone(company.phone ?? "");
    setWebsite(company.website ?? "");
    setAddress(company.address ?? "");
    setVatNumber(company.vat_number ?? "");
    setLogoPreview((company as any).logo_url ?? null);
  }, [company?.id]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const completionPercent = React.useMemo(() => {
    const fields = [phone, website, address, vatNumber, logoPreview];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }, [phone, website, address, vatNumber, logoPreview]);

  const save = async () => {
    if (!company?.id) return;
    setSaving(true);

    let logoUrl: string | null = (company as any)?.logo_url ?? null;

    // Upload logo if a new file was selected
    if (logoFile) {
      setUploading(true);
      const ext = logoFile.name.split(".").pop();
      const path = `${company.id}/logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("company-logos")
        .upload(path, logoFile, { upsert: true });
      setUploading(false);
      if (upErr) {
        toast({ title: "Logo upload failed", description: upErr.message, variant: "destructive" });
        setSaving(false);
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

    setSaving(false);

    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Profile saved!", description: "Your company profile is now complete." });
    await actions.refreshData();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Complete your company profile
          </DialogTitle>
          <DialogDescription>
            Add your logo and contact details so your dashboard, invoices, and certificates look professional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Profile completion</span>
              <span className="font-medium text-foreground">{completionPercent}%</span>
            </div>
            <Progress value={completionPercent} className="h-1.5" />
          </div>

          {/* Logo upload */}
          <div className="space-y-2">
            <Label>Company logo</Label>
            <div className="flex items-center gap-4">
              <div
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "relative h-20 w-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/60 hover:bg-secondary/30 transition-colors overflow-hidden",
                  logoPreview && "border-solid border-border/40",
                )}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain p-1" />
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
                <p className="text-xs text-muted-foreground">PNG or JPG, max 2 MB</p>
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

          {/* Contact fields */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cp-phone" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                Phone number
              </Label>
              <Input
                id="cp-phone"
                placeholder="+27 11 000 0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-website" className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                Website
              </Label>
              <Input
                id="cp-website"
                placeholder="https://yourcompany.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cp-address">Business address</Label>
              <Input
                id="cp-address"
                placeholder="123 Main St, Sandton"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-vat">VAT number</Label>
              <Input
                id="cp-vat"
                placeholder="4123456789"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onClose}>
              Do this later
            </Button>
            <Button
              className="gradient-bg hover:opacity-90 shadow-glow"
              onClick={save}
              disabled={saving || uploading}
            >
              {saving || uploading ? (
                <span className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-t-transparent border-primary-foreground animate-spin" />
                  {uploading ? "Uploading…" : "Saving…"}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Save profile
                </span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
