import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createDefaultCocCertificateData, createDefaultCocTestReportData, type CocCertificateType } from "@/features/coc/lib/sa-electrical-coc";

const schema = z.object({
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
  onCreated,
}: {
  companyId: string;
  sites: Array<Tables<"sites">> | null | undefined;
  onCreated: (row: Tables<"coc_certificates">) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      certificateNo: "",
      certificateType: "initial",
      issuedAt: new Date().toISOString().slice(0, 10),
      siteId: NONE,
    },
    mode: "onTouched",
  });

  const submit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const certificateType = values.certificateType as CocCertificateType;
      const cocData = createDefaultCocCertificateData();
      const testReport = createDefaultCocTestReportData();

      const selectedSite = values.siteId && values.siteId !== NONE
        ? (sites ?? []).find((s) => s.id === values.siteId) ?? null
        : null;

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

      const payload: TablesInsert<"coc_certificates"> = {
        company_id: companyId,
        customer_id: values.siteId && values.siteId !== NONE ? values.siteId : companyId,
        certificate_number: values.certificateNo.trim(),
        issued_date: values.issuedAt ? values.issuedAt : new Date().toISOString().slice(0, 10),
        site_id: values.siteId && values.siteId !== NONE ? values.siteId : null,
        certificate_no: values.certificateNo.trim(),
        certificate_type: certificateType,
        issued_at: values.issuedAt ? values.issuedAt : null,
        data: cocData as unknown as TablesInsert<"coc_certificates">["data"],
        test_report: testReport as unknown as TablesInsert<"coc_certificates">["test_report"],
      };

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
      form.reset({ certificateNo: "", certificateType: "initial", issuedAt: new Date().toISOString().slice(0, 10), siteId: NONE });
    } finally {
      setSaving(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-bg hover:opacity-90 shadow-glow">New CoC</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Create CoC certificate</DialogTitle>
          <DialogDescription>Creates a draft Certificate of Compliance (Annexure 1) and an attached Test Report template.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={submit} className="space-y-4">
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
