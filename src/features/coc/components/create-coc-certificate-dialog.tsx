import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createDefaultCocCertificateData, createDefaultCocTestReportData, type CocCertificateType } from "@/features/coc/lib/sa-electrical-coc";
import { isCocComplianceJob } from "@/features/coc/lib/is-coc-job";

const schema = z.object({
  jobId: z.string().optional(),
  certificateNo: z.string().min(1, "Certificate number is required"),
  certificateType: z.enum(["initial", "supplementary"]),
  issuedAt: z.string().optional(),
  siteId: z.string().optional(),
});

type Values = z.infer<typeof schema>;

const NONE = "__none__";

export default function CreateCocCertificateDialog({
  companyId,
  sites,
  jobs,
  initialJobId,
  trigger,
  open: openProp,
  onOpenChange,
  onCreated,
}: {
  companyId: string;
  sites: Array<Tables<"sites">> | null | undefined;
  jobs?: any[] | null | undefined;
  initialJobId?: string | null | undefined;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated: (row: Tables<"coc_certificates">) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = typeof openProp === "boolean" ? openProp : uncontrolledOpen;
  const setOpen = typeof openProp === "boolean" ? (onOpenChange ?? (() => {})) : onOpenChange ?? setUncontrolledOpen;
  const [saving, setSaving] = React.useState(false);
  const [jobsLoading, setJobsLoading] = React.useState(false);
  const [jobRows, setJobRows] = React.useState<any[]>([]);
  const [showAllJobs, setShowAllJobs] = React.useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      jobId: NONE,
      certificateNo: "",
      certificateType: "initial",
      issuedAt: new Date().toISOString().slice(0, 10),
      siteId: NONE,
    },
    mode: "onTouched",
  });

  const loadJobs = React.useCallback(async () => {
    if (jobs) {
      setJobRows(jobs ?? []);
      return;
    }
    setJobsLoading(true);
    try {
      const { data, error } = await supabase
        .from("job_cards")
        .select("id, title, description, notes, status, site_id, customer_id, updated_at, customers(name), sites(name, address)")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) {
        toast({ title: "Could not load jobs", description: error.message, variant: "destructive" });
        return;
      }
      setJobRows(data ?? []);
    } finally {
      setJobsLoading(false);
    }
  }, [companyId, jobs]);

  React.useEffect(() => {
    if (!open) return;
    void loadJobs();
  }, [loadJobs, open]);

  React.useEffect(() => {
    if (!open) return;
    if (!initialJobId) return;
    form.setValue("jobId", initialJobId, { shouldDirty: true });
  }, [form, initialJobId, open]);

  const selectedJobId = form.watch("jobId");
  const selectedJob = React.useMemo(() => {
    if (!selectedJobId || selectedJobId === NONE) return null;
    return jobRows.find((j) => j.id === selectedJobId) ?? null;
  }, [jobRows, selectedJobId]);

  React.useEffect(() => {
    if (!open) return;
    if (!selectedJob) return;
    if (selectedJob.site_id) {
      form.setValue("siteId", selectedJob.site_id, { shouldDirty: true });
    }
  }, [form, open, selectedJob]);

  const submit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const certificateType = values.certificateType as CocCertificateType;
      const cocData = createDefaultCocCertificateData();
      const testReport = createDefaultCocTestReportData();

      const effectiveSiteId = selectedJob?.site_id ?? (values.siteId && values.siteId !== NONE ? values.siteId : null);
      const selectedSite = effectiveSiteId ? (sites ?? []).find((s) => s.id === effectiveSiteId) ?? null : null;

      if (selectedSite) {
        const addr = selectedSite.address ?? "";
        const name = selectedSite.name ?? "";
        if (addr) {
          cocData.installation.physical_address = addr;
          testReport.location.physical_address = addr;
        }
        if (name) {
          cocData.installation.building_name = name;
          testReport.location.building_name = name;
        }
      }

      if (values.issuedAt) {
        testReport.date_of_issue = values.issuedAt;
      }

      const customerName = (selectedJob as any)?.customers?.name as string | undefined;
      if (customerName) cocData.recipient.name = customerName;

      const payload = {
        company_id: companyId,
        site_id: effectiveSiteId,
        job_card_id: selectedJob ? selectedJob.id : null,
        certificate_no: values.certificateNo.trim(),
        certificate_type: certificateType,
        issued_at: values.issuedAt ? values.issuedAt : null,
        data: cocData,
        test_report: testReport,
      } as any;

      const { data, error } = await supabase
        .from("coc_certificates")
        .insert(payload)
        .select("*")
        .single();

      if (error || !data) {
        toast({ title: "Could not create CoC", description: error?.message ?? "Unknown error", variant: "destructive" });
        return;
      }

      toast({ title: "CoC created" });
      onCreated(data);
      setOpen(false);
      form.reset({ jobId: NONE, certificateNo: "", certificateType: "initial", issuedAt: new Date().toISOString().slice(0, 10), siteId: NONE });
    } finally {
      setSaving(false);
    }
  });

  const filteredJobs = React.useMemo(() => {
    const base = jobRows ?? [];
    if (showAllJobs) return base;
    return base.filter(isCocComplianceJob);
  }, [jobRows, showAllJobs]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : openProp == null ? (
        <DialogTrigger asChild>
          <Button className="gradient-bg hover:opacity-90 shadow-glow">New CoC</Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Create CoC certificate</DialogTitle>
          <DialogDescription>
            Choose a job (recommended) to attach this CoC to a job card, then create a draft Certificate of Compliance (Annexure 1) + Test Report template.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={submit} className="space-y-4">
            <FormField
              control={form.control}
              name="jobId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job (recommended)</FormLabel>
                  <Select value={field.value ?? NONE} onValueChange={field.onChange} disabled={jobsLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={jobsLoading ? "Loading jobs…" : "Select a job"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>No job</SelectItem>
                      {filteredJobs.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center justify-between pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => setShowAllJobs((v) => !v)}
                      disabled={jobsLoading}
                    >
                      {showAllJobs ? "Show only compliance jobs" : "Show all jobs"}
                    </Button>
                    {selectedJob ? (
                      <span className="text-[11px] text-muted-foreground">
                        {selectedJob.status}
                        {(selectedJob as any)?.sites?.name ? ` • ${(selectedJob as any).sites.name}` : ""}
                      </span>
                    ) : null}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="certificateNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unique certificate number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. ECB 123456" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="certificateType"
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

              <FormField
                control={form.control}
                name="issuedAt"
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
            </div>

            <FormField
              control={form.control}
              name="siteId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site (optional)</FormLabel>
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

            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
