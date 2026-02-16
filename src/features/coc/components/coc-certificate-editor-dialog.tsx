import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import CocPrintPreview from "@/features/coc/components/coc-print-preview";
import SignatureCapture from "@/features/coc/components/signature-capture";
import {
  createDefaultCocCertificateData,
  createDefaultCocTestReportData,
  type CocCertificateData,
  type CocCertificateType,
  type CocTestReportData,
  type CocTestItemResult,
} from "@/features/coc/lib/sa-electrical-coc";

const schema = z.object({
  certificate_no: z.string().min(1, "Certificate number is required"),
  certificate_type: z.enum(["initial", "supplementary"]),
  issued_at: z.string().optional(),
  site_id: z.string().optional(),
  data: z.any(),
  test_report: z.any(),
});

type FormValues = z.infer<typeof schema> & {
  certificate_type: CocCertificateType;
  site_id: string;
  data: CocCertificateData;
  test_report: CocTestReportData;
};

const NONE = "__none__";

type UnknownRecord = Record<string, unknown>;
function asRecord(v: unknown): UnknownRecord | null {
  return v && typeof v === "object" ? (v as UnknownRecord) : null;
}

function normalizeCocData(raw: unknown): CocCertificateData {
  const d = createDefaultCocCertificateData();
  const obj = asRecord(raw);
  if (!obj) return d;

  const installation = asRecord(obj["installation"]);
  const supplementary = asRecord(obj["supplementary"]);
  const registeredPerson = asRecord(obj["registered_person"]);
  const registeredPersonContact = asRecord(registeredPerson?.["contact"]);
  const electricalContractor = asRecord(obj["electrical_contractor"]);
  const electricalContractorContact = asRecord(electricalContractor?.["contact"]);
  const recipient = asRecord(obj["recipient"]);

  return {
    ...d,
    ...(obj as unknown as Partial<CocCertificateData>),
    installation: { ...d.installation, ...(installation as unknown as Partial<CocCertificateData["installation"]> ?? {}) },
    supplementary: { ...d.supplementary, ...(supplementary as unknown as Partial<CocCertificateData["supplementary"]> ?? {}) },
    registered_person: {
      ...d.registered_person,
      ...(registeredPerson as unknown as Partial<CocCertificateData["registered_person"]> ?? {}),
      contact: { ...d.registered_person.contact, ...(registeredPersonContact as unknown as Partial<CocCertificateData["registered_person"]["contact"]> ?? {}) },
    },
    electrical_contractor: {
      ...d.electrical_contractor,
      ...(electricalContractor as unknown as Partial<CocCertificateData["electrical_contractor"]> ?? {}),
      contact: { ...d.electrical_contractor.contact, ...(electricalContractorContact as unknown as Partial<CocCertificateData["electrical_contractor"]["contact"]> ?? {}) },
    },
    recipient: { ...d.recipient, ...(recipient as unknown as Partial<CocCertificateData["recipient"]> ?? {}) },
  };
}

function normalizeTestReport(raw: unknown): CocTestReportData {
  const d = createDefaultCocTestReportData();
  const obj = asRecord(raw);
  if (!obj) return d;
  const location = asRecord(obj["location"]);
  const installation = asRecord(obj["installation"]);
  const responsibility = asRecord(obj["responsibility"]);
  const testsRaw = obj["tests"];

  const mergedTests = Array.isArray(testsRaw)
    ? testsRaw.map((t, i) => {
      const rec = asRecord(t);
      return { ...d.tests[i], ...(rec as unknown as Partial<CocTestReportData["tests"][number]> ?? {}) };
    }).filter(Boolean)
    : d.tests;

  return {
    ...d,
    ...(obj as unknown as Partial<CocTestReportData>),
    location: { ...d.location, ...(location as unknown as Partial<CocTestReportData["location"]> ?? {}) },
    installation: { ...d.installation, ...(installation as unknown as Partial<CocTestReportData["installation"]> ?? {}) },
    tests: mergedTests.length > 0 ? mergedTests : d.tests,
    responsibility: { ...d.responsibility, ...(responsibility as unknown as Partial<CocTestReportData["responsibility"]> ?? {}) },
  };
}

function missingForPrint(values: FormValues, includeTestReport: boolean): string[] {
  const missing: string[] = [];
  if (!values.certificate_no?.trim()) missing.push("Certificate No.");
  if (!values.issued_at?.trim()) missing.push("Date of issue");
  if (!values.data.installation.physical_address?.trim()) missing.push("Installation physical address");
  if (!values.data.installation.suburb_township?.trim()) missing.push("Installation suburb / township");
  if (!values.data.installation.district_town_city?.trim()) missing.push("Installation district / town / city");
  if (!values.data.registered_person.full_name?.trim()) missing.push("Registered person full name");
  if (!values.data.registered_person.id_number?.trim()) missing.push("Registered person ID No.");
  if (!values.data.registered_person.registration_number?.trim()) missing.push("Registered person DoL registration number");
  if (!values.data.registered_person.registration_type) missing.push("Registered person registration category");
  if (!values.data.registered_person.signature_data_url) missing.push("Registered person signature");
  if (!values.data.registered_person.signed_at?.trim()) missing.push("Registered person signed at / date");

  if (!values.data.electrical_contractor.contact.name?.trim()) missing.push("Electrical contractor business / trading name");
  if (!values.data.electrical_contractor.full_name?.trim()) missing.push("Electrical contractor signatory full name");
  if (!values.data.electrical_contractor.registration_number?.trim()) missing.push("Electrical contractor registration number");
  if (!values.data.electrical_contractor.signature_data_url) missing.push("Electrical contractor signature");
  if (!values.data.electrical_contractor.signed_at?.trim()) missing.push("Electrical contractor signed at / date");

  if (values.certificate_type === "supplementary") {
    if (!values.data.supplementary.supplement_no?.trim()) missing.push("Supplement No.");
    if (!values.data.supplementary.initial_certificate_no?.trim()) missing.push("Initial certificate No.");
  }
  if (includeTestReport) {
    if (!values.test_report.description_of_installation?.trim()) missing.push("Test report Section 3 description");
  }
  return missing;
}

export default function CocCertificateEditorDialog({
  open,
  onOpenChange,
  coc,
  sites,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coc: Tables<"coc_certificates">;
  sites: Array<Tables<"sites">> | null | undefined;
  onSaved: (row: Tables<"coc_certificates">) => void;
  onDeleted: (id: string) => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [includeTestReport, setIncludeTestReport] = React.useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      certificate_no: coc.certificate_no,
      certificate_type: (coc.certificate_type as CocCertificateType) ?? "initial",
      issued_at: coc.issued_at ?? "",
      site_id: coc.site_id ?? NONE,
      data: normalizeCocData(coc.data),
      test_report: normalizeTestReport(coc.test_report),
    },
    mode: "onTouched",
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      certificate_no: coc.certificate_no,
      certificate_type: (coc.certificate_type as CocCertificateType) ?? "initial",
      issued_at: coc.issued_at ?? "",
      site_id: coc.site_id ?? NONE,
      data: normalizeCocData(coc.data),
      test_report: normalizeTestReport(coc.test_report),
    });
    setIncludeTestReport(true);
  }, [coc, form, open]);

  const siteId = form.watch("site_id");
  const selectedSite = React.useMemo(() => (sites ?? []).find((s) => s.id === siteId) ?? null, [siteId, sites]);

  const applySiteAddress = React.useCallback(() => {
    if (!selectedSite) return;
    const addr = selectedSite.address ?? "";
    const name = selectedSite.name ?? "";
    form.setValue("data.installation.physical_address", addr, { shouldDirty: true });
    form.setValue("data.installation.building_name", name, { shouldDirty: true });
    form.setValue("test_report.location.physical_address", addr, { shouldDirty: true });
    form.setValue("test_report.location.building_name", name, { shouldDirty: true });
    toast({ title: "Site details applied" });
  }, [form, selectedSite]);

  const save = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const patch: TablesUpdate<"coc_certificates"> = {
        certificate_no: values.certificate_no.trim(),
        certificate_type: values.certificate_type,
        issued_at: values.issued_at ? values.issued_at : null,
        site_id: values.site_id && values.site_id !== NONE ? values.site_id : null,
        data: values.data as unknown as TablesUpdate<"coc_certificates">["data"],
        test_report: values.test_report as unknown as TablesUpdate<"coc_certificates">["test_report"],
      };

      const { data, error } = await supabase
        .from("coc_certificates")
        .update(patch)
        .eq("id", coc.id)
        .select("*")
        .single();

      if (error || !data) {
        toast({ title: "Save failed", description: error?.message ?? "Unknown error", variant: "destructive" });
        return;
      }
      toast({ title: "Saved" });
      onSaved(data);
    } finally {
      setSaving(false);
    }
  });

  const del = async () => {
    const ok = window.confirm(`Delete CoC ${coc.certificate_no}? This cannot be undone.`);
    if (!ok) return;
    const { error } = await supabase.from("coc_certificates").delete().eq("id", coc.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    onDeleted(coc.id);
    onOpenChange(false);
  };

  const watched = form.watch();

  const print = () => {
    const missing = missingForPrint(watched, includeTestReport);
    if (missing.length > 0) {
      toast({ title: "Missing required fields", description: missing.join(", "), variant: "destructive" });
      return;
    }
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px] h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="p-6 border-b no-print">
          <DialogHeader>
            <DialogTitle>CoC: {coc.certificate_no}</DialogTitle>
            <DialogDescription>South Africa (Electrical Installation Regulations, 2009 Annexure 1) + Test Report template.</DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="certificate" className="h-full flex flex-col">
            <div className="px-6 pt-4 flex items-center justify-between gap-3 no-print">
              <TabsList>
                <TabsTrigger value="certificate">Certificate</TabsTrigger>
                <TabsTrigger value="test-report">Test report</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={del}>
                  Delete
                </Button>
                <Button type="button" variant="outline" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>

            <TabsContent value="certificate" className="flex-1 overflow-auto px-6 pb-6 pt-4">
              <Form {...form}>
                <form className="space-y-6">
                  <div className="rounded-xl border bg-card/70 backdrop-blur-sm p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="certificate_no"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unique certificate number</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="issued_at"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of issue</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="certificate_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Certificate type</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="initial">Initial</SelectItem>
                                <SelectItem value="supplementary">Supplementary</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="site_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Site</FormLabel>
                            <Select value={field.value ?? NONE} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a site" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={NONE}>No site</SelectItem>
                                {(sites ?? []).map((s) => (
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
                      <div className="flex items-end">
                        <Button type="button" variant="outline" onClick={applySiteAddress} disabled={!selectedSite}>
                          Use site address
                        </Button>
                      </div>
                    </div>
                  </div>

                  {watched.certificate_type === "supplementary" ? (
                    <div className="rounded-xl border bg-card/70 backdrop-blur-sm p-5 space-y-4">
                      <div className="font-semibold">Supplement details</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="data.supplementary.supplement_no"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Supplement No.</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="data.supplementary.initial_certificate_no"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Initial Certificate No.</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="data.supplementary.initial_issued_on"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Initial issued on</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-xl border bg-card/70 backdrop-blur-sm p-5 space-y-4">
                    <div className="font-semibold">Installation identification</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="data.installation.physical_address"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Physical address</FormLabel>
                            <FormControl>
                              <Textarea rows={3} {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.installation.building_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name of building</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.installation.gps_coordinates"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>GPS Coordinates</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.installation.suburb_township"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Suburb / Township</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.installation.pole_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pole number</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.installation.district_town_city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>District / Town / City</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.installation.erf_lot_no"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Erf / Lot No.</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.other_reference"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Other reference</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card/70 backdrop-blur-sm p-5 space-y-4">
                    <div className="font-semibold">Declaration by registered person</div>
                    <div className="text-sm text-muted-foreground">
                      Declaration of compliance: a registered person confirms the installation was inspected/tested and meets the Electrical Installation Regulations.
                    </div>

                    <FormField
                      control={form.control}
                      name="data.basis"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Installation type</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="9(2)(a)">New installation</SelectItem>
                              <SelectItem value="9(2)(b)">Existing installation</SelectItem>
                              <SelectItem value="9(2)(c)">Addition / alteration to existing</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="data.registered_person.full_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.registered_person.id_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ID No.</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.registered_person.registration_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>DoL registration number</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.registered_person.registration_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of registration</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.registered_person.registration_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Registration category</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="ETSP">Electrical tester for single phase (ETSP)</SelectItem>
                                <SelectItem value="IE">Installation electrician (IE)</SelectItem>
                                <SelectItem value="MIE">Master installation electrician (MIE)</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="data.registered_person.contact.tel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tel</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.registered_person.contact.cell"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cell</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.registered_person.contact.fax"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fax</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.registered_person.contact.email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.registered_person.contact.address"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                              <Textarea rows={3} {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="data.registered_person.signature_data_url"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormControl>
                              <SignatureCapture label="Signature" value={field.value} onChange={(v) => field.onChange(v)} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.registered_person.signed_at"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Signed at / Date</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Cape Town, 2026-02-16" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card/70 backdrop-blur-sm p-5 space-y-4">
                    <div className="font-semibold">Declaration by electrical contractor</div>
                    <div className="text-sm text-muted-foreground">
                      Contractor declaration: the electrical contractor confirms the work was carried out in accordance with the Occupational Health and Safety Act and applicable regulations.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="data.electrical_contractor.full_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.electrical_contractor.id_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ID No.</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.electrical_contractor.registration_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contractor registration number</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.electrical_contractor.registration_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of registration</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="data.electrical_contractor.contact.name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Business / trading name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.electrical_contractor.contact.tel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tel</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.electrical_contractor.contact.cell"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cell</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.electrical_contractor.contact.fax"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fax</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.electrical_contractor.contact.email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.electrical_contractor.contact.address"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                              <Textarea rows={3} {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="data.electrical_contractor.signature_data_url"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormControl>
                              <SignatureCapture label="Signature" value={field.value} onChange={(v) => field.onChange(v)} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.electrical_contractor.signed_at"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Signed at / Date</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Johannesburg, 2026-02-16" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card/70 backdrop-blur-sm p-5 space-y-4">
                    <div className="font-semibold">Recipient</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="data.recipient.name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Recipient name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.recipient.signed_at"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data.recipient.signature_data_url"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormControl>
                              <SignatureCapture label="Recipient signature" value={field.value} onChange={(v) => field.onChange(v)} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="test-report" className="flex-1 overflow-auto px-6 pb-6 pt-4">
              <Form {...form}>
                <form className="space-y-6">
                  <div className="rounded-xl border bg-card/70 backdrop-blur-sm p-5 space-y-4">
                    <div className="font-semibold">Test report header</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="test_report.db_supply_no"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>DB / Supply No.</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="test_report.date_of_issue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of issue</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="flex items-end">
                        <Button type="button" variant="outline" onClick={applySiteAddress} disabled={!selectedSite}>
                          Use site address
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card/70 backdrop-blur-sm p-5 space-y-4">
                    <div className="font-semibold">Section 3 – Installation covered</div>
                    <FormField
                      control={form.control}
                      name="test_report.description_of_installation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea rows={5} placeholder="Describe the installation and scope covered by this test report…" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="rounded-xl border bg-card/70 backdrop-blur-sm p-5 space-y-4">
                    <div className="font-semibold">Section 4 – Tests (summary)</div>
                    <div className="space-y-4">
                      {watched.test_report.tests.map((t, idx) => (
                        <div key={t.key} className="rounded-lg border p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
                          <div className="md:col-span-5">
                            <div className="text-sm font-medium">{t.label}</div>
                            <div className="text-xs text-muted-foreground">Key: {t.key}</div>
                          </div>
                          <div className="md:col-span-2">
                            <FormField
                              control={form.control}
                              name={`test_report.tests.${idx}.result`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Result</FormLabel>
                                  <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value={"pass" satisfies CocTestItemResult}>Pass</SelectItem>
                                      <SelectItem value={"fail" satisfies CocTestItemResult}>Fail</SelectItem>
                                      <SelectItem value={"na" satisfies CocTestItemResult}>N/A</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <FormField
                              control={form.control}
                              name={`test_report.tests.${idx}.value`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Value</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="md:col-span-3">
                            <FormField
                              control={form.control}
                              name={`test_report.tests.${idx}.comments`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Comments</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card/70 backdrop-blur-sm p-5 space-y-4">
                    <div className="font-semibold">Section 5 – Responsibility</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="test_report.responsibility.annex_pages_count"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel># of annex pages</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="test_report.responsibility.full_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="test_report.responsibility.id_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ID No.</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="test_report.responsibility.tel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tel</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="test_report.responsibility.email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="test_report.responsibility.registration_certificate_no"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Registration certificate No.</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="test_report.responsibility.date_of_registration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of registration</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="test_report.responsibility.registration_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type of registration</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="ETSP">ETSP</SelectItem>
                                <SelectItem value="IE">IE</SelectItem>
                                <SelectItem value="MIE">MIE</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="test_report.responsibility.signed_at"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Signed at / Date</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Durban, 2026-02-16" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="test_report.responsibility.signature_data_url"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormControl>
                              <SignatureCapture label="Signature" value={field.value} onChange={(v) => field.onChange(v)} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="preview" className="flex-1 overflow-auto px-6 pb-6 pt-4">
              <div className="flex items-center justify-between gap-3 no-print">
                <div className="flex items-center gap-2">
                  <Checkbox checked={includeTestReport} onCheckedChange={(v) => setIncludeTestReport(Boolean(v))} id="include-test-report" />
                  <label htmlFor="include-test-report" className="text-sm">
                    Include test report pages
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={save} disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button type="button" onClick={print}>
                    Print / PDF
                  </Button>
                </div>
              </div>

              <div className="print-area mt-4 bg-white text-black p-4 rounded-lg border">
                <CocPrintPreview
                  certificateNo={watched.certificate_no}
                  certificateType={watched.certificate_type}
                  issuedAt={watched.issued_at || ""}
                  data={watched.data}
                  testReport={watched.test_report}
                  includeTestReport={includeTestReport}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
