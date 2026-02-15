import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatDistanceToNowStrict } from "date-fns";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

type SolarProject = Tables<"solar_projects">;
type SolarBattery = Tables<"solar_batteries">;
type SolarProjectBattery = Tables<"solar_project_batteries">;
type SolarPanelModel = Tables<"solar_panel_models">;
type SolarProjectPanel = Tables<"solar_project_panels">;
type SolarChecklistItem = Tables<"solar_project_checklist_items">;
type SolarSignoff = Tables<"solar_project_signoffs">;

const createProjectSchema = z.object({
  title: z.string().min(2, "Project title is required"),
  siteId: z.string().optional(),
  notes: z.string().optional(),
});

type CreateProjectValues = z.infer<typeof createProjectSchema>;

const addBatterySchema = z.object({
  serial: z.string().min(3, "Serial is required"),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  capacityKwh: z.string().optional(),
  notes: z.string().optional(),
});

type AddBatteryValues = z.infer<typeof addBatterySchema>;

const addPanelModelSchema = z.object({
  manufacturer: z.string().optional(),
  model: z.string().min(2, "Model is required"),
  wattage: z.string().optional(),
  sku: z.string().optional(),
});

type AddPanelModelValues = z.infer<typeof addPanelModelSchema>;

function defaultSolarChecklistLabels() {
  return [
    "Site assessment completed (roof, shading, structure)",
    "DB / main isolator verified and labeled",
    "Earthing + bonding checked and documented",
    "Inverter mounted and torque settings verified",
    "DC string polarity verified",
    "DC isolators installed + tested",
    "Cable routes secured + UV-rated where required",
    "Panels installed and clamped to spec",
    "Battery installed + serial recorded",
    "Commissioning: firmware updated + parameters set",
    "Monitoring configured and verified",
    "Final inspection photos captured (before/after)",
  ];
}

function stepLabel(step: SolarSignoff["step"]) {
  if (step === "installer") return "Installer sign-off";
  if (step === "supervisor") return "Supervisor sign-off";
  return "Customer sign-off";
}

async function ensureDefaultSignoffs(projectId: string) {
  const { data: existing } = await supabase
    .from("solar_project_signoffs")
    .select("*")
    .eq("project_id", projectId);

  const existingSteps = new Set((existing ?? []).map((s) => s.step));
  const needed: SolarSignoff["step"][] = ["installer", "supervisor", "customer"];
  const toInsert = needed.filter((s) => !existingSteps.has(s)).map((s) => ({ project_id: projectId, step: s }));
  if (toInsert.length === 0) return;
  await supabase.from("solar_project_signoffs").insert(toInsert as any);
}

function CreateSolarProjectDialog({ onCreated }: { onCreated: () => void }) {
  const { data } = useDashboardData();
  const [open, setOpen] = React.useState(false);

  const form = useForm<CreateProjectValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      title: "",
      siteId: "",
      notes: "",
    },
    mode: "onTouched",
  });

  const submit = form.handleSubmit(async (values) => {
    if (!data.company) return;
    const { data: created, error } = await supabase
      .from("solar_projects")
      .insert({
        company_id: data.company.id,
        title: values.title,
        site_id: values.siteId ? values.siteId : null,
        notes: values.notes || null,
      })
      .select()
      .single();
    if (error || !created) return;
    await ensureDefaultSignoffs(created.id);
    setOpen(false);
    form.reset({ title: "", siteId: "", notes: "" });
    onCreated();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gradient-bg hover:opacity-90 shadow-glow">
          Create solar project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create solar project</DialogTitle>
          <DialogDescription>Track batteries, panel allocation, checklist compliance, and sign-offs.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={submit} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Smith Residence - 8kW + battery" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="siteId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site (optional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="No site" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">No site</SelectItem>
                      {data.sites.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting || !data.company}>
                {form.formState.isSubmitting ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ManageSolarProjectDialog({ project, onChanged }: { project: SolarProject; onChanged: () => void }) {
  const { data: dashboard } = useDashboardData();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [batteries, setBatteries] = React.useState<SolarBattery[]>([]);
  const [projectBatteries, setProjectBatteries] = React.useState<SolarProjectBattery[]>([]);
  const [panelModels, setPanelModels] = React.useState<SolarPanelModel[]>([]);
  const [projectPanels, setProjectPanels] = React.useState<SolarProjectPanel[]>([]);
  const [checklist, setChecklist] = React.useState<SolarChecklistItem[]>([]);
  const [signoffs, setSignoffs] = React.useState<SolarSignoff[]>([]);

  const [existingBatteryId, setExistingBatteryId] = React.useState<string>("");
  const [existingPanelModelId, setExistingPanelModelId] = React.useState<string>("");
  const [panelAllocated, setPanelAllocated] = React.useState<string>("0");
  const [panelInstalled, setPanelInstalled] = React.useState<string>("0");

  const addBatteryForm = useForm<AddBatteryValues>({
    resolver: zodResolver(addBatterySchema),
    defaultValues: { serial: "", manufacturer: "", model: "", capacityKwh: "", notes: "" },
    mode: "onTouched",
  });

  const addPanelModelForm = useForm<AddPanelModelValues>({
    resolver: zodResolver(addPanelModelSchema),
    defaultValues: { manufacturer: "", model: "", wattage: "", sku: "" },
    mode: "onTouched",
  });

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const [bRes, pbRes, pmRes, ppRes, cRes, sRes] = await Promise.all([
      supabase.from("solar_batteries").select("*").order("created_at", { ascending: false }),
      supabase.from("solar_project_batteries").select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
      supabase.from("solar_panel_models").select("*").order("created_at", { ascending: false }),
      supabase.from("solar_project_panels").select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
      supabase.from("solar_project_checklist_items").select("*").eq("project_id", project.id).order("created_at", { ascending: true }),
      supabase.from("solar_project_signoffs").select("*").eq("project_id", project.id).order("created_at", { ascending: true }),
    ]);
    setBatteries(bRes.data ?? []);
    setProjectBatteries(pbRes.data ?? []);
    setPanelModels(pmRes.data ?? []);
    setProjectPanels(ppRes.data ?? []);
    setChecklist(cRes.data ?? []);
    setSignoffs(sRes.data ?? []);
    setLoading(false);
  }, [project.id]);

  React.useEffect(() => {
    if (!open) return;
    ensureDefaultSignoffs(project.id).then(() => refresh());
    setExistingBatteryId("");
    setExistingPanelModelId("");
    setPanelAllocated("0");
    setPanelInstalled("0");
  }, [open, project.id, refresh]);

  const assignedBatteryIds = new Set(projectBatteries.map((pb) => pb.battery_id));
  const availableBatteries = batteries.filter((b) => !assignedBatteryIds.has(b.id));

  const checklistRequired = checklist.filter((i) => i.required);
  const checklistCompleted = checklistRequired.filter((i) => i.completed).length;
  const checklistTotal = checklistRequired.length;
  const checklistPct = checklistTotal === 0 ? 0 : Math.round((checklistCompleted / checklistTotal) * 100);

  const site = project.site_id ? dashboard.sites.find((s) => s.id === project.site_id) : undefined;

  const addExistingBattery = async () => {
    if (!existingBatteryId) return;
    const { error } = await supabase.from("solar_project_batteries").insert({
      project_id: project.id,
      battery_id: existingBatteryId,
      status: "allocated",
    });
    if (error) return;
    setExistingBatteryId("");
    await refresh();
    onChanged();
  };

  const addNewBattery = addBatteryForm.handleSubmit(async (values) => {
    if (!dashboard.company) return;
    const cap = values.capacityKwh ? Number(values.capacityKwh) : undefined;
    const { data: created, error } = await supabase
      .from("solar_batteries")
      .insert({
        company_id: dashboard.company.id,
        serial: values.serial.trim(),
        manufacturer: values.manufacturer ? values.manufacturer : null,
        model: values.model ? values.model : null,
        capacity_kwh: values.capacityKwh && Number.isFinite(cap) ? cap : null,
        notes: values.notes ? values.notes : null,
      })
      .select()
      .single();
    if (error || !created) return;
    await supabase.from("solar_project_batteries").insert({
      project_id: project.id,
      battery_id: created.id,
      status: "allocated",
    });
    addBatteryForm.reset({ serial: "", manufacturer: "", model: "", capacityKwh: "", notes: "" });
    await refresh();
    onChanged();
  });

  const setBatteryStatus = async (pb: SolarProjectBattery, status: SolarProjectBattery["status"]) => {
    const now = new Date().toISOString();
    const patch: any = { status };
    if (status === "installed") patch.installed_at = now;
    if (status === "removed") patch.removed_at = now;
    const { error } = await supabase.from("solar_project_batteries").update(patch).eq("id", pb.id);
    if (error) return;
    await refresh();
    onChanged();
  };

  const removeBatteryFromProject = async (pbId: string) => {
    const { error } = await supabase.from("solar_project_batteries").delete().eq("id", pbId);
    if (error) return;
    await refresh();
    onChanged();
  };

  const addPanelModel = addPanelModelForm.handleSubmit(async (values) => {
    if (!dashboard.company) return;
    const wattage = values.wattage ? Number(values.wattage) : undefined;
    const { data: created, error } = await supabase
      .from("solar_panel_models")
      .insert({
        company_id: dashboard.company.id,
        manufacturer: values.manufacturer ? values.manufacturer : null,
        model: values.model.trim(),
        wattage: values.wattage && Number.isFinite(wattage) ? Math.round(wattage) : null,
        sku: values.sku ? values.sku : null,
      })
      .select()
      .single();
    if (error || !created) return;
    addPanelModelForm.reset({ manufacturer: "", model: "", wattage: "", sku: "" });
    await refresh();
  });

  const upsertProjectPanels = async () => {
    if (!existingPanelModelId) return;
    const allocated = Math.max(0, Math.round(Number(panelAllocated) || 0));
    const installed = Math.max(0, Math.round(Number(panelInstalled) || 0));
    const { error } = await supabase.from("solar_project_panels").upsert(
      {
        project_id: project.id,
        panel_model_id: existingPanelModelId,
        quantity_allocated: allocated,
        quantity_installed: Math.min(installed, allocated),
      } as any,
      { onConflict: "project_id,panel_model_id" },
    );
    if (error) return;
    setPanelAllocated("0");
    setPanelInstalled("0");
    await refresh();
    onChanged();
  };

  const toggleChecklist = async (item: SolarChecklistItem) => {
    const next = !item.completed;
    const patch: any = { completed: next, completed_at: next ? new Date().toISOString() : null, completed_by: next ? (await supabase.auth.getUser()).data.user?.id ?? null : null };
    const { error } = await supabase.from("solar_project_checklist_items").update(patch).eq("id", item.id);
    if (error) return;
    await refresh();
  };

  const initializeChecklist = async () => {
    if (checklist.length > 0) return;
    const items = defaultSolarChecklistLabels().map((label) => ({ project_id: project.id, label, required: true }));
    await supabase.from("solar_project_checklist_items").insert(items as any);
    await refresh();
  };

  const addChecklistItem = async (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    await supabase.from("solar_project_checklist_items").insert({ project_id: project.id, label: trimmed, required: true } as any);
    await refresh();
  };

  const sign = async (step: SolarSignoff["step"]) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;
    const { error } = await supabase
      .from("solar_project_signoffs")
      .upsert(
        {
          project_id: project.id,
          step,
          status: "signed",
          signed_by: userId,
          signed_at: new Date().toISOString(),
        } as any,
        { onConflict: "project_id,step" },
      );
    if (error) return;
    await refresh();
    onChanged();
  };

  const reject = async (step: SolarSignoff["step"], notes: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;
    const { error } = await supabase
      .from("solar_project_signoffs")
      .upsert(
        {
          project_id: project.id,
          step,
          status: "rejected",
          signed_by: userId,
          signed_at: new Date().toISOString(),
          notes: notes || null,
        } as any,
        { onConflict: "project_id,step" },
      );
    if (error) return;
    await refresh();
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Manage
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Solar project tracking</DialogTitle>
          <DialogDescription>
            {project.title}
            {site ? ` • ${site.name}` : ""}
            {checklistTotal > 0 ? ` • Checklist ${checklistPct}%` : ""}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="batteries" className="w-full">
          <TabsList>
            <TabsTrigger value="batteries">Batteries</TabsTrigger>
            <TabsTrigger value="panels">Panels</TabsTrigger>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="signoff">Sign-off</TabsTrigger>
          </TabsList>

          <TabsContent value="batteries" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assign existing battery</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={existingBatteryId} onValueChange={setExistingBatteryId}>
                    <SelectTrigger className="sm:w-[420px]">
                      <SelectValue placeholder={availableBatteries.length ? "Select battery..." : "No batteries available"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBatteries.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.serial} {b.model ? `• ${b.model}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={addExistingBattery} disabled={!existingBatteryId || loading}>
                    Assign
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Add new battery (serial tracking)</Label>
                <Form {...addBatteryForm}>
                  <form onSubmit={addNewBattery} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                      control={addBatteryForm.control}
                      name="serial"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Serial</FormLabel>
                          <FormControl>
                            <Input placeholder="Battery serial" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addBatteryForm.control}
                      name="manufacturer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manufacturer</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Tesla" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addBatteryForm.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Powerwall 2" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addBatteryForm.control}
                      name="capacityKwh"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>kWh (optional)</FormLabel>
                          <FormControl>
                            <Input inputMode="decimal" placeholder="e.g. 13.5" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addBatteryForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Notes (optional)</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="sm:col-span-2 flex justify-end">
                      <Button type="submit" disabled={addBatteryForm.formState.isSubmitting || loading || !dashboard.company}>
                        Add & assign
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </div>

            <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serial</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[260px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectBatteries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                        No batteries assigned yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {projectBatteries.map((pb) => {
                    const b = batteries.find((x) => x.id === pb.battery_id);
                    return (
                      <TableRow key={pb.id}>
                        <TableCell className="font-medium">{b?.serial ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{b?.model ?? "—"}</TableCell>
                        <TableCell className="capitalize">{pb.status.replace("_", " ")}</TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" variant="outline" onClick={() => setBatteryStatus(pb, "installed")} disabled={pb.status === "installed"}>
                            Mark installed
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setBatteryStatus(pb, "removed")} disabled={pb.status === "removed"}>
                            Mark removed
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => removeBatteryFromProject(pb.id)}>
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="panels" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Allocate panels to this site</Label>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-2">
                    <Select value={existingPanelModelId} onValueChange={setExistingPanelModelId}>
                      <SelectTrigger>
                        <SelectValue placeholder={panelModels.length ? "Select panel model..." : "No panel models"} />
                      </SelectTrigger>
                      <SelectContent>
                        {panelModels.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {(m.manufacturer ? `${m.manufacturer} ` : "") + m.model}
                            {m.wattage ? ` • ${m.wattage}W` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input inputMode="numeric" placeholder="Allocated" value={panelAllocated} onChange={(e) => setPanelAllocated(e.target.value)} />
                  <Input inputMode="numeric" placeholder="Installed" value={panelInstalled} onChange={(e) => setPanelInstalled(e.target.value)} />
                </div>
                <div className="flex justify-end">
                  <Button onClick={upsertProjectPanels} disabled={!existingPanelModelId || loading}>
                    Save allocation
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Add panel model</Label>
                <Form {...addPanelModelForm}>
                  <form onSubmit={addPanelModel} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                      control={addPanelModelForm.control}
                      name="manufacturer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manufacturer</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Jinko" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addPanelModelForm.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Tiger Neo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addPanelModelForm.control}
                      name="wattage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Wattage</FormLabel>
                          <FormControl>
                            <Input inputMode="numeric" placeholder="e.g. 550" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addPanelModelForm.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SKU (optional)</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="sm:col-span-2 flex justify-end">
                      <Button type="submit" disabled={addPanelModelForm.formState.isSubmitting || loading || !dashboard.company}>
                        Add model
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </div>

            <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Panel model</TableHead>
                    <TableHead>Allocated</TableHead>
                    <TableHead>Installed</TableHead>
                    <TableHead>Site</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectPanels.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                        No panel allocations yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {projectPanels.map((pp) => {
                    const model = panelModels.find((m) => m.id === pp.panel_model_id);
                    return (
                      <TableRow key={pp.id}>
                        <TableCell className="font-medium">
                          {(model?.manufacturer ? `${model.manufacturer} ` : "") + (model?.model ?? "—")}
                          {model?.wattage ? <span className="text-muted-foreground"> • {model.wattage}W</span> : null}
                        </TableCell>
                        <TableCell>{pp.quantity_allocated}</TableCell>
                        <TableCell>{pp.quantity_installed}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{site?.name ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="checklist" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Required: {checklistCompleted}/{checklistTotal} complete{checklistTotal ? ` (${checklistPct}%)` : ""}.
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={initializeChecklist} disabled={checklist.length > 0 || loading}>
                  Initialize default checklist
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Done</TableHead>
                    <TableHead>Checklist item</TableHead>
                    <TableHead>Required</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checklist.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                        No checklist items yet. Initialize the default checklist to start tracking compliance.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {checklist.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <input type="checkbox" checked={item.completed} onChange={() => toggleChecklist(item)} />
                      </TableCell>
                      <TableCell className={item.completed ? "line-through text-muted-foreground" : ""}>{item.label}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.required ? "Yes" : "No"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1 space-y-1">
                <Label>Add checklist item</Label>
                <Input
                  placeholder="New checklist item…"
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const value = (e.target as HTMLInputElement).value;
                    (e.target as HTMLInputElement).value = "";
                    addChecklistItem(value);
                  }}
                />
              </div>
              <div className="text-xs text-muted-foreground sm:pb-2">Press Enter to add</div>
            </div>
          </TabsContent>

          <TabsContent value="signoff" className="space-y-4">
            <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Step</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Signed</TableHead>
                    <TableHead className="w-[320px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signoffs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                        Loading sign-offs…
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {signoffs.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{stepLabel(s.step)}</TableCell>
                      <TableCell className="capitalize">{s.status}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.signed_at ? new Date(s.signed_at).toLocaleString() : "—"}</TableCell>
                      <TableCell className="space-x-2">
                        <Button size="sm" variant="outline" onClick={() => sign(s.step)} disabled={loading}>
                          Sign
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const notes = window.prompt("Rejection notes (optional)") ?? "";
                            reject(s.step, notes);
                          }}
                          disabled={loading}
                        >
                          Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SolarProjects() {
  const { data } = useDashboardData();
  const [projects, setProjects] = React.useState<SolarProject[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const { data: rows } = await supabase.from("solar_projects").select("*").order("created_at", { ascending: false });
    setProjects(rows ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const sitesById = new Map(data.sites.map((s) => [s.id, s]));

  if (data.company?.industry !== "electrical-contracting") {
    return (
      <div className="space-y-6">
        <PageHeader title="Solar projects" subtitle="Solar project tracking is available in the Electrical dashboard." />
        <div className="text-sm text-muted-foreground">Switch to an Electrical company to use Solar Project Tracking.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solar projects"
        subtitle="Battery serial tracking, panel allocation per site, checklist compliance, and sign-off workflow."
        actions={<CreateSolarProjectDialog onCreated={refresh} />}
      />

      <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  Loading…
                </TableCell>
              </TableRow>
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  No solar projects yet.
                </TableCell>
              </TableRow>
            ) : null}
            {projects.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">{p.notes ?? "—"}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.site_id ? sitesById.get(p.site_id)?.name ?? "—" : "—"}</TableCell>
                <TableCell className="capitalize">{p.status.replace("-", " ")}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNowStrict(new Date(p.updated_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                  <ManageSolarProjectDialog project={p} onChanged={refresh} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

