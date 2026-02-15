import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { fromDatetimeLocal, toDatetimeLocal } from "@/features/dashboard/lib/datetime";
import { computeJobProfitability } from "@/features/dashboard/lib/profitability";
import ProfitabilityPill from "@/features/dashboard/components/profitability-pill";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatUsdFromCents } from "@/lib/money";
import { ExternalLink, Trash2 } from "lucide-react";
import * as React from "react";

type JobCard = Tables<"job_cards"> & { site_id?: string | null };
type JobTimeEntry = any;
type JobPhoto = any;
type SiteMaterialUsage = any;
type SiteDocument = any;

function sanitizeFilename(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

async function openSignedUrl(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) {
    toast({ title: "Error", description: error?.message ?? "Could not generate link", variant: "destructive" });
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export default function JobSiteControlsDialog({ jobId }: { jobId: string }) {
  const { profile } = useAuth();
  const { data, actions } = useDashboardData();
  const companyId = profile?.company_id ?? null;

  const job = data.jobCards.find((j) => j.id === jobId) as JobCard | undefined;
  const [open, setOpen] = React.useState(false);

  const [timeEntries, setTimeEntries] = React.useState<JobTimeEntry[]>([]);
  const [photos, setPhotos] = React.useState<JobPhoto[]>([]);
  const [materials, setMaterials] = React.useState<SiteMaterialUsage[]>([]);
  const [documents, setDocuments] = React.useState<SiteDocument[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [revenue, setRevenue] = React.useState("");
  const [savingRevenue, setSavingRevenue] = React.useState(false);

  const [timeForm, setTimeForm] = React.useState({
    technicianId: "",
    startedAt: "",
    endedAt: "",
    minutes: "",
    notes: "",
  });

  const [photoKind, setPhotoKind] = React.useState<"before" | "after">("before");
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement | null>(null);

  const [materialItemId, setMaterialItemId] = React.useState("");
  const [materialQtyUsed, setMaterialQtyUsed] = React.useState("1");
  const [materialQtyWasted, setMaterialQtyWasted] = React.useState("0");
  const [materialNotes, setMaterialNotes] = React.useState("");
  const [materialWasteNotes, setMaterialWasteNotes] = React.useState("");

  const [docFile, setDocFile] = React.useState<File | null>(null);
  const docInputRef = React.useRef<HTMLInputElement | null>(null);

  const site = job?.site_id ? data.sites.find((s) => s.id === job.site_id) : undefined;

  const refresh = React.useCallback(async (siteIdOverride?: string | null) => {
    if (!job) return;
    setLoading(true);
    const [tRes, pRes] = await Promise.all([
      (supabase as any).from("job_time_entries").select("*").eq("job_card_id", job.id).order("started_at", { ascending: false }),
      (supabase as any).from("job_photos").select("*").eq("job_card_id", job.id).order("created_at", { ascending: false }),
    ]);

    setTimeEntries(tRes.data ?? []);
    setPhotos(pRes.data ?? []);

    const siteId = siteIdOverride === undefined ? job.site_id : siteIdOverride;
    if (siteId) {
      const [mRes, dRes] = await Promise.all([
        (supabase as any)
          .from("site_material_usage")
          .select("*")
          .eq("site_id", siteId)
          .eq("job_card_id", job.id)
          .order("used_at", { ascending: false }),
        (supabase as any)
          .from("site_documents")
          .select("*")
          .eq("site_id", siteId)
          .in("kind", ["coc", "other"])
          .order("created_at", { ascending: false }),
      ]);
      setMaterials(mRes.data ?? []);
      setDocuments(dRes.data ?? []);
    } else {
      setMaterials([]);
      setDocuments([]);
    }
    setLoading(false);
  }, [job]);

  React.useEffect(() => {
    if (!open) return;
    refresh();
    if (job) {
      const r = (job as any).revenue_cents;
      setRevenue(typeof r === "number" ? (r / 100).toFixed(2) : "");
      setTimeForm((prev) => ({
        ...prev,
        technicianId: job.technician_id ?? "",
        startedAt: toDatetimeLocal(new Date().toISOString()),
        endedAt: "",
        minutes: "",
        notes: "",
      }));
      setMaterialItemId(data.inventoryItems[0]?.id ?? "");
      setMaterialQtyUsed("1");
      setMaterialQtyWasted("0");
      setMaterialNotes("");
      setMaterialWasteNotes("");
      setPhotoKind("before");
      setPhotoFile(null);
      setDocFile(null);
    }
  }, [data.inventoryItems, job, open, refresh]);

  if (!job) return null;

  const siteOptions = data.sites.filter((s) => (s as any).customer_id === job.customer_id);
  const sitesForSelect = siteOptions.length ? siteOptions : data.sites;

  const techniciansById = React.useMemo(() => new Map(data.technicians.map((t) => [t.id, t])), [data.technicians]);
  const inventoryById = React.useMemo(() => new Map(data.inventoryItems.map((i) => [i.id, i])), [data.inventoryItems]);

  const profitability = React.useMemo(() => {
    return computeJobProfitability({
      job,
      timeEntries,
      materials,
      techniciansById,
      inventoryById,
    });
  }, [inventoryById, job, materials, techniciansById, timeEntries]);

  const saveRevenue = async () => {
    const v = revenue.trim();
    if (v && !/^\d+(\.\d{1,2})?$/.test(v)) {
      toast({ title: "Invalid revenue", description: "Use numbers like 1200 or 1200.00.", variant: "destructive" });
      return;
    }
    const cents = v ? Math.round(Number.parseFloat(v) * 100) : null;
    setSavingRevenue(true);
    await actions.setJobRevenue(job.id, cents);
    setSavingRevenue(false);
  };

  const logTime = async () => {
    const started = fromDatetimeLocal(timeForm.startedAt);
    if (!started) {
      toast({ title: "Missing start time", variant: "destructive" });
      return;
    }
    const ended = timeForm.endedAt ? fromDatetimeLocal(timeForm.endedAt) : undefined;
    const minutesFromInput = timeForm.minutes ? Number(timeForm.minutes) : undefined;
    const minutes =
      Number.isFinite(minutesFromInput) && minutesFromInput !== undefined
        ? Math.max(0, Math.round(minutesFromInput))
        : ended
          ? Math.max(0, Math.round((new Date(ended).getTime() - new Date(started).getTime()) / 60000))
          : undefined;

    const { error } = await (supabase as any).from("job_time_entries").insert({
      job_card_id: job.id,
      technician_id: timeForm.technicianId ? timeForm.technicianId : null,
      started_at: started,
      ended_at: ended ?? null,
      minutes: minutes ?? null,
      notes: timeForm.notes ? timeForm.notes : null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Time logged" });
    await refresh();
  };

  const uploadPhoto = async () => {
    if (!companyId) return;
    if (!photoFile) return;
    const filename = `${crypto.randomUUID()}-${sanitizeFilename(photoFile.name)}`;
    const path = `${companyId}/jobs/${job.id}/${photoKind}/${filename}`;
    const { error: uploadErr } = await supabase.storage.from("job-photos").upload(path, photoFile, {
      contentType: photoFile.type || undefined,
      upsert: false,
    });
    if (uploadErr) {
      toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" });
      return;
    }

    const { error: rowErr } = await (supabase as any).from("job_photos").insert({
      job_card_id: job.id,
      kind: photoKind,
      storage_path: path,
      taken_at: new Date().toISOString(),
      caption: null,
    });
    if (rowErr) {
      toast({ title: "Error", description: rowErr.message, variant: "destructive" });
      await supabase.storage.from("job-photos").remove([path]);
      return;
    }
    toast({ title: "Photo added" });
    setPhotoFile(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
    await refresh();
  };

  const deletePhoto = async (p: JobPhoto) => {
    await supabase.storage.from("job-photos").remove([p.storage_path]);
    const { error } = await (supabase as any).from("job_photos").delete().eq("id", p.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Photo deleted" });
    await refresh();
  };

  const logMaterial = async () => {
    if (!job.site_id) {
      toast({ title: "Set a site first", description: "Material usage is tracked per site.", variant: "destructive" });
      return;
    }
    const used = Number(materialQtyUsed);
    const wasted = Number(materialQtyWasted);
    if (!Number.isFinite(used) || used < 0 || !Number.isFinite(wasted) || wasted < 0 || (used + wasted) <= 0) {
      toast({ title: "Invalid quantities", description: "Used and wasted must be >= 0, and total must be > 0.", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any).from("site_material_usage").insert({
      site_id: job.site_id,
      job_card_id: job.id,
      inventory_item_id: materialItemId,
      quantity_used: Math.round(used),
      quantity_wasted: Math.round(wasted),
      waste_notes: materialWasteNotes ? materialWasteNotes : null,
      notes: materialNotes ? materialNotes : null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await actions.adjustInventory(materialItemId, -Math.round(used + wasted));
    toast({ title: "Material logged" });
    setMaterialQtyUsed("1");
    setMaterialQtyWasted("0");
    setMaterialNotes("");
    setMaterialWasteNotes("");
    await refresh();
  };

  const uploadCoc = async () => {
    if (!companyId) return;
    if (!job.site_id) {
      toast({ title: "Set a site first", description: "COC docs are stored per site.", variant: "destructive" });
      return;
    }
    if (!docFile) return;
    const filename = `${crypto.randomUUID()}-${sanitizeFilename(docFile.name)}`;
    const path = `${companyId}/sites/${job.site_id}/coc/${filename}`;
    const { error: uploadErr } = await supabase.storage.from("site-documents").upload(path, docFile, {
      contentType: docFile.type || undefined,
      upsert: false,
    });
    if (uploadErr) {
      toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" });
      return;
    }
    const { error: rowErr } = await (supabase as any).from("site_documents").insert({
      site_id: job.site_id,
      job_card_id: job.id,
      kind: "coc",
      title: docFile.name,
      storage_path: path,
      metadata: { contentType: docFile.type, size: docFile.size },
    });
    if (rowErr) {
      toast({ title: "Error", description: rowErr.message, variant: "destructive" });
      await supabase.storage.from("site-documents").remove([path]);
      return;
    }
    toast({ title: "COC uploaded" });
    setDocFile(null);
    if (docInputRef.current) docInputRef.current.value = "";
    await refresh();
  };

  const deleteDoc = async (d: SiteDocument) => {
    await supabase.storage.from("site-documents").remove([d.storage_path]);
    const { error } = await (supabase as any).from("site_documents").delete().eq("id", d.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Document deleted" });
    await refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Site controls
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Site-level controls</DialogTitle>
          <DialogDescription>
            {job.title} {site ? `• ${site.name}` : "• No site set"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-card/70 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium">Gross margin</div>
                <div className="text-xs text-muted-foreground">
                  Revenue {profitability.revenueCents === null ? "—" : formatUsdFromCents(profitability.revenueCents)} · Labour{" "}
                  {formatUsdFromCents(profitability.laborCostCents)} · Materials {formatUsdFromCents(profitability.materialCostCents)} · Waste{" "}
                  {formatUsdFromCents(profitability.wasteCostCents)}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <ProfitabilityPill value={profitability} />
                <div className="flex items-center gap-2">
                  <Input
                    className="h-9 w-[160px]"
                    inputMode="decimal"
                    placeholder="Revenue (USD)"
                    value={revenue}
                    onChange={(e) => setRevenue(e.target.value)}
                  />
                  <Button size="sm" onClick={saveRevenue} disabled={savingRevenue}>
                    {savingRevenue ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="space-y-1">
              <Label>Job site</Label>
              <Select
                value={job.site_id ?? ""}
                onValueChange={async (v) => {
                  const nextSiteId = v || null;
                  await actions.setJobCardSite(job.id, nextSiteId);
                  await refresh(nextSiteId);
                }}
              >
                <SelectTrigger className="sm:w-[420px]">
                  <SelectValue placeholder="No site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No site</SelectItem>
                  {sitesForSelect.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground sm:pt-6">
              {job.site_id ? "Materials + COC docs attach to this site." : "Set a site to enable materials + COC docs."}
            </div>
          </div>

          <Tabs defaultValue="time" className="w-full">
            <TabsList>
              <TabsTrigger value="time">Time</TabsTrigger>
              <TabsTrigger value="photos">Photos</TabsTrigger>
              <TabsTrigger value="materials">Materials</TabsTrigger>
              <TabsTrigger value="coc">COC docs</TabsTrigger>
            </TabsList>

            <TabsContent value="time" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <Label>Technician</Label>
                  <Select value={timeForm.technicianId} onValueChange={(v) => setTimeForm((p) => ({ ...p, technicianId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {data.technicians.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Started</Label>
                  <Input type="datetime-local" value={timeForm.startedAt} onChange={(e) => setTimeForm((p) => ({ ...p, startedAt: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Ended (optional)</Label>
                  <Input type="datetime-local" value={timeForm.endedAt} onChange={(e) => setTimeForm((p) => ({ ...p, endedAt: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Minutes (optional)</Label>
                  <Input inputMode="numeric" value={timeForm.minutes} onChange={(e) => setTimeForm((p) => ({ ...p, minutes: e.target.value }))} />
                </div>
                <div className="flex items-end">
                  <Button onClick={logTime} disabled={loading}>
                    Log time
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea value={timeForm.notes} onChange={(e) => setTimeForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
              </div>

              <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Started</TableHead>
                      <TableHead>Ended</TableHead>
                      <TableHead>Minutes</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                          No time entries yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {timeEntries.map((t) => {
                      const tech = t.technician_id ? data.technicians.find((x) => x.id === t.technician_id) : undefined;
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="text-sm text-muted-foreground">{new Date(t.started_at).toLocaleString()}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{t.ended_at ? new Date(t.ended_at).toLocaleString() : "—"}</TableCell>
                          <TableCell>{t.minutes ?? "—"}</TableCell>
                          <TableCell>{tech?.name ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{t.notes ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="photos" className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="space-y-1">
                  <Label>Kind</Label>
                  <Select value={photoKind} onValueChange={(v) => setPhotoKind(v as "before" | "after")}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before">Before</SelectItem>
                      <SelectItem value="after">After</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 flex-1">
                  <Label>Upload</Label>
                  <Input ref={photoInputRef} type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
                </div>
                <Button onClick={uploadPhoto} disabled={!photoFile || loading}>
                  Add photo
                </Button>
              </div>

              <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kind</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="w-[160px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {photos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                          No photos yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {photos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="capitalize">{p.kind}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.storage_path.split("/").slice(-1)[0]}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(p.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" variant="outline" onClick={() => openSignedUrl("job-photos", p.storage_path)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deletePhoto(p)} aria-label="Delete photo">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="materials" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div className="space-y-1 md:col-span-2">
                  <Label>Inventory item</Label>
                  <Select value={materialItemId} onValueChange={setMaterialItemId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.inventoryItems.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name} ({i.quantity_on_hand} on hand)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Used</Label>
                  <Input inputMode="numeric" value={materialQtyUsed} onChange={(e) => setMaterialQtyUsed(e.target.value)} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Notes (optional)</Label>
                  <Input value={materialNotes} onChange={(e) => setMaterialNotes(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Wasted</Label>
                  <Input inputMode="numeric" value={materialQtyWasted} onChange={(e) => setMaterialQtyWasted(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Wastage notes (optional)</Label>
                <Input value={materialWasteNotes} onChange={(e) => setMaterialWasteNotes(e.target.value)} />
              </div>
              <Button onClick={logMaterial} disabled={!materialItemId || loading || !job.site_id}>
                Log material usage
              </Button>

              <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Used</TableHead>
                      <TableHead>Wasted</TableHead>
                      <TableHead>Logged</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!job.site_id ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                          Set a site on this job to track material usage per site.
                        </TableCell>
                      </TableRow>
                    ) : materials.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                          No material usage logged for this job.
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {materials.map((m) => {
                      const item = data.inventoryItems.find((i) => i.id === m.inventory_item_id);
                      const wasted = (m as any).quantity_wasted ?? 0;
                      const wasteNotes = (m as any).waste_notes ?? null;
                      return (
                        <TableRow key={m.id}>
                          <TableCell>{item?.name ?? "—"}</TableCell>
                          <TableCell>{m.quantity_used}</TableCell>
                          <TableCell>{wasted}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{new Date(m.used_at).toLocaleString()}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {m.notes ?? "—"}
                            {wasteNotes ? <div className="text-xs text-muted-foreground mt-1">Waste: {wasteNotes}</div> : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="coc" className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="space-y-1 flex-1">
                  <Label>Upload COC (PDF/image)</Label>
                  <Input ref={docInputRef} type="file" accept="application/pdf,image/*" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
                </div>
                <Button onClick={uploadCoc} disabled={!docFile || loading || !job.site_id}>
                  Upload
                </Button>
              </div>

              <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="w-[160px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!job.site_id ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                          Set a site on this job to store COC documentation per site.
                        </TableCell>
                      </TableRow>
                    ) : documents.filter((d) => d.kind === "coc").length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                          No COC documents yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {documents
                      .filter((d) => d.kind === "coc")
                      .map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="uppercase">COC</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{d.title}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{new Date(d.created_at).toLocaleString()}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button size="sm" variant="outline" onClick={() => openSignedUrl("site-documents", d.storage_path)}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteDoc(d)} aria-label="Delete document">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
