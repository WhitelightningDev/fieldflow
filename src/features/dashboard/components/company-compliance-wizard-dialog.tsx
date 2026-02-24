import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getComplianceRequirements, type ComplianceDocRequirement } from "@/features/compliance/compliance-requirements";
import { getComplianceState } from "@/features/compliance/compliance-status";
import { isTradeId, type TradeId, getTradeById } from "@/features/company-signup/content/trades";
import { CheckCircle2, FileUp, ExternalLink, Trash2, ShieldAlert } from "lucide-react";

type DocRow = {
  id: string;
  company_id: string;
  industry: string | null;
  kind: string;
  label: string;
  storage_path: string;
  created_at: string;
  updated_at: string;
};

function extFromName(name: string) {
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1] : "";
  return ext ? ext.toLowerCase() : "pdf";
}

export default function CompanyComplianceWizardDialog({
  open,
  onOpenChange,
  company,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: any;
  canEdit: boolean;
}) {
  const companyId = company?.id as string | null | undefined;
  const industry: TradeId | null = isTradeId(company?.industry) ? company.industry : null;
  const tradeLabel = industry ? getTradeById(industry).shortName : "Industry";

  const requirements = React.useMemo(() => (industry ? getComplianceRequirements(industry) : []), [industry]);

  const [docs, setDocs] = React.useState<DocRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [uploadingKind, setUploadingKind] = React.useState<string | null>(null);
  const [removingKind, setRemovingKind] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const pendingKindRef = React.useRef<string | null>(null);

  const docsByKind = React.useMemo(() => {
    const m = new Map<string, DocRow>();
    for (const d of docs) {
      const prev = m.get(d.kind);
      if (!prev) m.set(d.kind, d);
      else {
        const a = new Date(prev.updated_at ?? prev.created_at).getTime();
        const b = new Date(d.updated_at ?? d.created_at).getTime();
        if (b >= a) m.set(d.kind, d);
      }
    }
    return m;
  }, [docs]);

  const requiredKinds = React.useMemo(() => new Set(requirements.filter((r) => r.required).map((r) => r.kind)), [requirements]);
  const requiredUploadedCount = React.useMemo(() => {
    let n = 0;
    for (const kind of requiredKinds) if (docsByKind.has(kind)) n += 1;
    return n;
  }, [docsByKind, requiredKinds]);
  const requiredTotal = requiredKinds.size;
  const progress = requiredTotal === 0 ? 0 : Math.round((requiredUploadedCount / requiredTotal) * 100);

  const refreshDocs = React.useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("company_compliance_documents")
        .select("*")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setDocs((data ?? []) as any);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load documents";
      toast({ title: "Compliance wizard unavailable", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const syncCompanyCompliance = React.useCallback(async (nextProgress: number) => {
    if (!companyId) return;
    const complianceStatus = nextProgress >= 100 ? "verified" : nextProgress > 0 ? "in_progress" : "unverified";
    const { error } = await supabase
      .from("companies")
      .update({ compliance_progress: nextProgress, compliance_status: complianceStatus, compliance_updated_at: new Date().toISOString() } as any)
      .eq("id", companyId);
    if (error) {
      toast({ title: "Compliance status not updated", description: error.message, variant: "destructive" });
    }
  }, [companyId]);

  React.useEffect(() => {
    if (!open) return;
    void refreshDocs();
  }, [open, refreshDocs]);

  React.useEffect(() => {
    if (!open) return;
    void syncCompanyCompliance(progress);
  }, [open, progress, syncCompanyCompliance]);

  const pickFileFor = (kind: string) => {
    pendingKindRef.current = kind;
    fileRef.current?.click();
  };

  const uploadForRequirement = async (req: ComplianceDocRequirement, file: File) => {
    if (!companyId || !industry) return;
    if (!canEdit) {
      toast({ title: "Not allowed", description: "Only an admin/owner can manage compliance.", variant: "destructive" });
      return;
    }
    setUploadingKind(req.kind);
    try {
      const ext = extFromName(file.name);
      const path = `${companyId}/${req.kind}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("compliance-docs")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: row, error } = await (supabase as any)
        .from("company_compliance_documents")
        .upsert(
          {
            company_id: companyId,
            industry,
            kind: req.kind,
            label: req.title,
            storage_path: path,
          } as any,
          { onConflict: "company_id,kind" } as any,
        )
        .select()
        .single();
      if (error) throw error;

      setDocs((prev) => {
        const next = prev.filter((d) => d.kind !== req.kind);
        next.unshift(row as any);
        return next;
      });
      toast({ title: "Document uploaded", description: req.title });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setUploadingKind(null);
      pendingKindRef.current = null;
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const viewDoc = async (doc: DocRow) => {
    const { data: signed, error } = await supabase.storage.from("compliance-docs").createSignedUrl(doc.storage_path, 60);
    if (error || !signed?.signedUrl) {
      toast({ title: "Could not open document", description: error?.message ?? "Signed URL unavailable.", variant: "destructive" });
      return;
    }
    window.open(signed.signedUrl, "_blank", "noreferrer");
  };

  const removeDoc = async (req: ComplianceDocRequirement) => {
    if (!companyId) return;
    if (!canEdit) {
      toast({ title: "Not allowed", description: "Only an admin/owner can manage compliance.", variant: "destructive" });
      return;
    }
    const doc = docsByKind.get(req.kind);
    if (!doc) return;
    setRemovingKind(req.kind);
    try {
      await supabase.storage.from("compliance-docs").remove([doc.storage_path]);
      const { error } = await (supabase as any)
        .from("company_compliance_documents")
        .delete()
        .eq("company_id", companyId)
        .eq("kind", req.kind);
      if (error) throw error;
      setDocs((prev) => prev.filter((d) => d.kind !== req.kind));
      toast({ title: "Document removed", description: req.title });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Remove failed";
      toast({ title: "Remove failed", description: msg, variant: "destructive" });
    } finally {
      setRemovingKind(null);
    }
  };

  const compliance = getComplianceState({ status: company?.compliance_status, progress: company?.compliance_progress ?? progress });

  if (!industry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Compliance wizard
          </DialogTitle>
          <DialogDescription>
            Upload documentation to show compliance for <span className="font-medium">{tradeLabel}</span>.{" "}
            For legal and trust reasons, it’s strongly recommended to keep this up to date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Compliance progress</span>
              <span className="font-medium text-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
            <div className="text-[11px] text-muted-foreground">
              Required documents uploaded: <span className="font-medium text-foreground">{requiredUploadedCount}</span> / {requiredTotal}
            </div>
          </div>

          <Card className="bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Required documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {requirements.filter((r) => r.required).map((r) => {
                const doc = docsByKind.get(r.kind) ?? null;
                const isUploading = uploadingKind === r.kind;
                const isRemoving = removingKind === r.kind;

                return (
                  <div key={r.kind} className="rounded-md border px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-medium truncate">{r.title}</div>
                          {doc ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" /> : null}
                        </div>
                        <div className="text-xs text-muted-foreground">{r.description}</div>
                        {doc ? (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Uploaded {new Date(doc.updated_at ?? doc.created_at).toLocaleString()}
                          </div>
                        ) : (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Missing — this will show a warning badge until uploaded.
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {doc ? (
                          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void viewDoc(doc)}>
                            <ExternalLink className="h-4 w-4" /> View
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1.5"
                          disabled={loading || isUploading || !canEdit}
                          onClick={() => pickFileFor(r.kind)}
                        >
                          <FileUp className="h-4 w-4" />
                          {doc ? "Replace" : "Upload"}
                        </Button>
                        {doc ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={isRemoving || !canEdit}
                            aria-label="Remove document"
                            onClick={() => void removeDoc(r)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {isUploading ? <div className="mt-2 text-xs text-muted-foreground">Uploading…</div> : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {requirements.some((r) => !r.required) ? (
            <Card className="bg-card/70 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Optional (recommended)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {requirements.filter((r) => !r.required).map((r) => {
                  const doc = docsByKind.get(r.kind) ?? null;
                  const isUploading = uploadingKind === r.kind;
                  const isRemoving = removingKind === r.kind;

                  return (
                    <div key={r.kind} className="rounded-md border px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-medium truncate">{r.title}</div>
                            {doc ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" /> : null}
                          </div>
                          <div className="text-xs text-muted-foreground">{r.description}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {doc ? (
                            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void viewDoc(doc)}>
                              <ExternalLink className="h-4 w-4" /> View
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="gap-1.5"
                            disabled={loading || isUploading || !canEdit}
                            onClick={() => pickFileFor(r.kind)}
                          >
                            <FileUp className="h-4 w-4" />
                            {doc ? "Replace" : "Upload"}
                          </Button>
                          {doc ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={isRemoving || !canEdit}
                              aria-label="Remove document"
                              onClick={() => void removeDoc(r)}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      {isUploading ? <div className="mt-2 text-xs text-muted-foreground">Uploading…</div> : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <div className="text-xs text-muted-foreground sm:mr-auto">
            Status: <span className="font-medium text-foreground">{compliance.label}</span>
          </div>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            const kind = pendingKindRef.current;
            if (!file || !kind) return;
            const req = requirements.find((r) => r.kind === kind);
            if (!req) return;
            void uploadForRequirement(req, file);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

