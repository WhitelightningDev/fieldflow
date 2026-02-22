import { useAuth } from "@/features/auth/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { EmptyStateCard } from "@/components/ui/empty-state-card";
import { Spinner } from "@/components/ui/spinner";
import JobTimer from "@/features/technician/components/job-timer";
import JobPhotoUpload from "@/features/technician/components/job-photo-upload";
import JobNotesEditor from "@/features/technician/components/job-notes-editor";
import JobPartsUsed from "@/features/technician/components/job-parts-used";
import SignaturePad from "@/features/technician/components/signature-pad";
import JobFlowSteps, { JOB_FLOW_STEPS, type JobFlowStep } from "@/features/technician/components/job-flow-steps";
import JobFlowPrompts from "@/features/technician/components/job-flow-prompts";
import JobQuickActions from "@/features/technician/components/job-quick-actions";
import JobInteractiveChecklist from "@/features/technician/components/job-interactive-checklist";
import JobInvoiceForm from "@/features/technician/components/job-invoice-form";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Phone,
  Mail,
  Play,
  User,
} from "lucide-react";
import * as React from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useRealtimeRefetch } from "@/hooks/use-realtime-refetch";

const statusColor: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  scheduled: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "in-progress": "bg-primary/10 text-primary",
  completed: "bg-primary/10 text-primary",
  invoiced: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
};

function deriveStep(job: any, hasInvoice: boolean): JobFlowStep {
  // NOTE: kept for compatibility; the real derive uses job evidence below.
  if (job.status === "invoiced" || hasInvoice) return "invoice";
  if (job.status === "completed") return "signoff";
  return "arrive";
}

type StepEvidence = {
  timeEntries: any[];
  usedParts: any[];
  checkedItems: boolean[];
  hasBeforePhotos: boolean;
  hasAfterPhotos: boolean;
  signatureCount: number;
  hasInvoice: boolean;
};

function hasMeaningfulNotes(notes: unknown) {
  return String(notes ?? "").trim().length > 0;
}

function deriveCompleted(job: any, evidence: StepEvidence): Set<JobFlowStep> {
  const {
    timeEntries,
    usedParts,
    checkedItems,
    hasBeforePhotos,
    hasAfterPhotos,
    signatureCount,
    hasInvoice,
  } = evidence;
  const s = new Set<JobFlowStep>();
  // "Arrive" is only complete once there's evidence (timer or before photos),
  // not merely because someone toggled status to in-progress elsewhere.
  if (hasBeforePhotos || timeEntries.length > 0) s.add("arrive");

  // "Diagnose" is complete once they checked any checklist item or captured notes.
  if (checkedItems.some(Boolean) || hasMeaningfulNotes(job?.notes)) s.add("diagnose");

  // "Work" is complete once time or parts are logged.
  if (timeEntries.length > 0 || usedParts.length > 0) s.add("work");

  // "Document" is complete once after photos exist.
  if (hasAfterPhotos) s.add("document");

  // "Sign-off" is complete once signed (or invoiced).
  if (signatureCount > 0 || job.status === "invoiced" || hasInvoice) s.add("signoff");

  if (hasInvoice || job.status === "invoiced") s.add("invoice");
  return s;
}

function deriveInitialStep(job: any, evidence: StepEvidence): JobFlowStep {
  const completed = deriveCompleted(job, evidence);

  if (job.status === "invoiced" || evidence.hasInvoice) return "invoice";
  if (job.status === "completed") return completed.has("signoff") ? "invoice" : "signoff";
  if (job.status === "cancelled") return "arrive";
  if (job.status === "new" || job.status === "scheduled") return "arrive";

  // For in-progress work, resume from the first incomplete step.
  for (const step of JOB_FLOW_STEPS) {
    if (!completed.has(step.id)) return step.id;
  }
  return "invoice";
}

export default function TechJobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const [job, setJob] = React.useState<any>(null);
  const [techId, setTechId] = React.useState<string | null>(null);
  const [techRate, setTechRate] = React.useState(0);
  const [timeEntries, setTimeEntries] = React.useState<any[]>([]);
  const [usedParts, setUsedParts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [currentStep, setCurrentStep] = React.useState<JobFlowStep>("arrive");
  const [checkedItems, setCheckedItems] = React.useState<boolean[]>([]);
  const [hasInvoice, setHasInvoice] = React.useState(false);
  const [beforePhotoCount, setBeforePhotoCount] = React.useState(0);
  const [afterPhotoCount, setAfterPhotoCount] = React.useState(0);
  const [signatureCount, setSignatureCount] = React.useState(0);

  const initialStepSetRef = React.useRef(false);

  const setStep = React.useCallback((step: JobFlowStep) => {
    setCurrentStep(step);
    try {
      const next = new URLSearchParams(searchParams);
      next.set("step", step);
      setSearchParams(next, { replace: true });
    } catch {
      // ignore
    }
  }, [searchParams, setSearchParams]);

  const stepIndex = React.useCallback((step: JobFlowStep) => JOB_FLOW_STEPS.findIndex((s) => s.id === step), []);
  const prevStep = React.useCallback((step: JobFlowStep) => {
    const idx = stepIndex(step);
    if (idx <= 0) return null;
    return JOB_FLOW_STEPS[idx - 1]?.id ?? null;
  }, [stepIndex]);
  const nextStep = React.useCallback((step: JobFlowStep) => {
    const idx = stepIndex(step);
    if (idx === -1) return null;
    return JOB_FLOW_STEPS[idx + 1]?.id ?? null;
  }, [stepIndex]);

  const fetchJob = React.useCallback(async () => {
    if (!jobId) return;
    const { data } = await supabase
      .from("job_cards")
      .select("*, customers(name, phone, email, address), sites(name, address)")
      .eq("id", jobId)
      .single();
    if (data) {
      setJob(data);
      // Parse checklist (can be string[] or {label,checked}[])
      const cl = Array.isArray(data.checklist) ? data.checklist : [];
      if (cl.length > 0 && typeof cl[0] === "object" && cl[0] !== null) {
        setCheckedItems(cl.map((c: any) => c.checked ?? false));
      } else {
        setCheckedItems(cl.map(() => false));
      }
    }
    setLoading(false);
  }, [jobId]);

  const fetchTimeEntries = React.useCallback(async () => {
    if (!jobId) return;
    const { data } = await supabase
      .from("job_time_entries")
      .select("*")
      .eq("job_card_id", jobId)
      .order("started_at", { ascending: false });
    setTimeEntries(data ?? []);
  }, [jobId]);

  const fetchUsedParts = React.useCallback(async () => {
    if (!jobId || !job?.site_id) return;
    const { data } = await supabase
      .from("site_material_usage")
      .select("*, inventory_items(name, unit, unit_cost_cents)")
      .eq("job_card_id", jobId)
      .order("used_at", { ascending: false });
    setUsedParts(data ?? []);
  }, [jobId, job?.site_id]);

  const fetchPhotoCounts = React.useCallback(async () => {
    if (!jobId) return;
    const [{ count: bCount }, { count: aCount }, { count: sCount }] = await Promise.all([
      supabase.from("job_photos").select("id", { count: "exact", head: true }).eq("job_card_id", jobId).eq("kind", "before"),
      supabase.from("job_photos").select("id", { count: "exact", head: true }).eq("job_card_id", jobId).eq("kind", "after"),
      supabase.from("job_photos").select("id", { count: "exact", head: true }).eq("job_card_id", jobId).eq("kind", "signature"),
    ]);
    setBeforePhotoCount(bCount ?? 0);
    setAfterPhotoCount(aCount ?? 0);
    setSignatureCount(sCount ?? 0);
  }, [jobId]);

  React.useEffect(() => {
    if (!user) return;
    supabase
      .from("technicians")
      .select("id, hourly_cost_cents")
      .eq("user_id", user.id)
      .single()
      .then(({ data: tech }) => {
        setTechId(tech?.id ?? null);
        setTechRate(tech?.hourly_cost_cents ?? 0);
      });
  }, [user]);

  React.useEffect(() => {
    fetchJob();
    fetchTimeEntries();
    fetchPhotoCounts();
  }, [fetchJob, fetchTimeEntries, fetchPhotoCounts]);

  useRealtimeRefetch({
    enabled: Boolean(jobId),
    channelName: `tech-job:${jobId ?? "none"}`,
    table: "job_cards",
    filter: jobId ? `id=eq.${jobId}` : undefined,
    debounceMs: 600,
    onRefetch: fetchJob,
  });

  React.useEffect(() => {
    if (job?.site_id) fetchUsedParts();
  }, [job?.site_id, fetchUsedParts]);

  // Check for existing invoice
  React.useEffect(() => {
    if (!jobId) return;
    supabase
      .from("invoices")
      .select("id")
      .eq("job_card_id", jobId)
      .limit(1)
      .then(({ data }) => setHasInvoice((data?.length ?? 0) > 0));
  }, [jobId]);

  // Initial step: URL > derived
  React.useEffect(() => {
    if (!job) return;
    if (initialStepSetRef.current) return;

    const urlStep = (searchParams.get("step") ?? "") as JobFlowStep;
    const isValidUrlStep = JOB_FLOW_STEPS.some((s) => s.id === urlStep);
    if (isValidUrlStep) {
      setCurrentStep(urlStep);
      initialStepSetRef.current = true;
      return;
    }

    setCurrentStep(deriveInitialStep(job, {
      timeEntries,
      usedParts,
      checkedItems,
      hasBeforePhotos: beforePhotoCount > 0,
      hasAfterPhotos: afterPhotoCount > 0,
      signatureCount,
      hasInvoice,
    }));
    initialStepSetRef.current = true;
  }, [afterPhotoCount, beforePhotoCount, checkedItems, hasInvoice, job, searchParams, signatureCount, timeEntries, usedParts]);

  // Keep URL in sync (best-effort)
  React.useEffect(() => {
    try {
      const current = searchParams.get("step");
      if (current === currentStep) return;
      const next = new URLSearchParams(searchParams);
      next.set("step", currentStep);
      setSearchParams(next, { replace: true });
    } catch {
      // ignore
    }
  }, [currentStep, searchParams, setSearchParams]);

  const completedSteps = job
    ? deriveCompleted(job, {
        timeEntries,
        usedParts,
        checkedItems,
        hasBeforePhotos: beforePhotoCount > 0,
        hasAfterPhotos: afterPhotoCount > 0,
        signatureCount,
        hasInvoice,
      })
    : new Set<JobFlowStep>();

  const updateStatus = async (status: string): Promise<boolean> => {
    if (!jobId) return false;
    const { error } = await supabase
      .from("job_cards")
      .update({ status: status as any })
      .eq("id", jobId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return false; }
    setJob((prev: any) => ({ ...prev, status }));
    toast({ title: `Job ${status === "in-progress" ? "started" : status}` });
    return true;
  };

  const totalMinutes = timeEntries
    .filter((e) => e.minutes != null)
    .reduce((sum, e) => sum + e.minutes, 0);

  const canGoNext = React.useMemo(() => {
    if (!job) return false;
    if (currentStep === "signoff") {
      return signatureCount > 0 || hasInvoice || job.status === "invoiced";
    }
    // Always allow finishing the flow on the last step.
    return nextStep(currentStep) !== null || currentStep === "invoice";
  }, [currentStep, hasInvoice, job, nextStep, signatureCount]);

  const goPrev = React.useCallback(() => {
    const prev = prevStep(currentStep);
    if (prev) setStep(prev);
  }, [currentStep, prevStep, setStep]);

  const goNext = React.useCallback(async () => {
    const next = nextStep(currentStep);
    if (!next) {
      // End of flow (invoice) -> back to job list
      navigate("/tech/my-jobs");
      return;
    }

    // Ensure job is "started" when leaving Arrive
    if (currentStep === "arrive" && (job.status === "new" || job.status === "scheduled")) {
      const ok = await updateStatus("in-progress");
      if (!ok) return;
    }

    if (currentStep === "signoff" && !(signatureCount > 0 || hasInvoice || job.status === "invoiced")) {
      toast({ title: "Signature required", description: "Capture customer signature before moving to invoicing.", variant: "destructive" });
      return;
    }

    setStep(next);
  }, [currentStep, hasInvoice, job, navigate, nextStep, setStep, signatureCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="gap-1.5">
          <Link to="/tech/my-jobs"><ArrowLeft className="h-4 w-4" /> Back</Link>
        </Button>
        <EmptyStateCard title="Job not found" />
      </div>
    );
  }

  const customer = (job as any).customers;
  const site = (job as any).sites;
  const checklist = Array.isArray(job.checklist)
    ? job.checklist.map((c: any) => (typeof c === "string" ? c : c.label ?? ""))
    : [];

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-3 mb-1">
          <Link to="/tech/my-jobs"><ArrowLeft className="h-4 w-4" /> Back</Link>
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">{job.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={statusColor[job.status] ?? ""}>{job.status}</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            {(job.status === "new" || job.status === "scheduled") && (
              <Button size="sm" onClick={() => void updateStatus("in-progress")} className="gradient-bg hover:opacity-90 shadow-glow gap-1.5">
                <Play className="h-3.5 w-3.5" /> Start Job
              </Button>
            )}
            {job.status === "in-progress" && (
              <Button size="sm" variant="outline" onClick={() => void updateStatus("completed")} className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Complete
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <JobQuickActions
        customerPhone={customer?.phone}
        siteAddress={site?.address}
        customerAddress={customer?.address}
      />

      {/* Step Navigator */}
      <JobFlowSteps
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={(step) => setStep(step)}
      />

      {/* Contextual Prompts */}
      <JobFlowPrompts step={currentStep} />

      {/* Step Content */}
      {currentStep === "arrive" && (
        <div className="space-y-4">
          {/* Timer */}
          {techId && (job.status === "in-progress" || job.status === "new" || job.status === "scheduled") && (
            <Card className="bg-card/70 backdrop-blur-sm">
              <CardContent className="py-4">
                <JobTimer jobId={job.id} technicianId={techId} onEntryChange={fetchTimeEntries} />
              </CardContent>
            </Card>
          )}

          {/* Client & Site Info */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="bg-card/70 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <User className="h-4 w-4 text-muted-foreground" /> Client
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="font-medium">{customer?.name ?? "—"}</div>
                {customer?.phone && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> {customer.phone}
                  </div>
                )}
                {customer?.email && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" /> {customer.email}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="bg-card/70 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Navigation className="h-4 w-4 text-muted-foreground" /> Site
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="font-medium">{site?.name ?? "No site"}</div>
                {site?.address && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {site.address}
                  </div>
                )}
                {job.scheduled_at && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> {new Date(job.scheduled_at).toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Before Photos */}
          <Card className="bg-card/70 backdrop-blur-sm">
            <CardContent className="py-4">
              <JobPhotoUpload jobId={job.id} kind="before" onUploaded={() => void fetchPhotoCounts()} />
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === "diagnose" && (
        <div className="space-y-4">
          {job.description && (
            <Card className="bg-card/70 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Job Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.description}</p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card/70 backdrop-blur-sm">
            <CardContent className="py-4">
              <JobInteractiveChecklist
                jobId={job.id}
                checklist={checklist}
                checkedItems={checkedItems}
                onUpdate={setCheckedItems}
              />
            </CardContent>
          </Card>

          <Card className="bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <JobNotesEditor
                jobId={job.id}
                initialNotes={job.notes}
                onSaved={() => {
                  if (currentStep !== "diagnose") return;
                  const next = nextStep("diagnose");
                  if (!next) return;
                  setStep(next);
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === "work" && (
        <div className="space-y-4">
          {/* Timer */}
          {techId && job.status === "in-progress" && (
            <Card className="bg-card/70 backdrop-blur-sm">
              <CardContent className="py-4">
                <JobTimer jobId={job.id} technicianId={techId} onEntryChange={fetchTimeEntries} />
              </CardContent>
            </Card>
          )}

          {/* Time Log */}
          <Card className="bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Time Logged — {totalMinutes} min
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No time logged yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {timeEntries.map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-sm py-1 px-3 rounded bg-secondary/50">
                      <span>{new Date(e.started_at).toLocaleString()}</span>
                      <span className="text-muted-foreground">{e.minutes != null ? `${e.minutes} min` : "Running…"}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parts */}
          {profile?.company_id && (
            <Card className="bg-card/70 backdrop-blur-sm">
              <CardContent className="py-4">
                <JobPartsUsed
                  jobId={job.id}
                  siteId={job.site_id}
                  companyId={profile.company_id}
                  onPartsLogged={() => void fetchUsedParts()}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {currentStep === "document" && (
        <div className="space-y-4">
          <Card className="bg-card/70 backdrop-blur-sm">
            <CardContent className="py-4 space-y-6">
              <JobPhotoUpload
                jobId={job.id}
                kind="after"
                onUploaded={() => {
                  void fetchPhotoCounts();
                  // Only auto-advance if they are actively on the Document step.
                  if (currentStep !== "document") return;
                  // Don't repeatedly kick them forward if they are uploading multiple photos.
                  if (afterPhotoCount > 0) return;
                  const next = nextStep("document");
                  if (!next) return;
                  setStep(next);
                }}
              />
            </CardContent>
          </Card>

          <Card className="bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <JobNotesEditor
                jobId={job.id}
                initialNotes={job.notes}
                onSaved={() => {
                  if (currentStep !== "document") return;
                  const next = nextStep("document");
                  if (!next) return;
                  setStep(next);
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === "signoff" && (
        <div className="space-y-4">
          {job.status === "in-progress" && (
            <Card className="bg-card/70 backdrop-blur-sm border-amber-500/30">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Complete the job before capturing signature.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => void updateStatus("completed")} className="gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark Complete
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {(job.status === "completed" || job.status === "invoiced") && (
            <Card className="bg-card/70 backdrop-blur-sm">
              <CardContent className="py-4">
                <SignaturePad
                  jobId={job.id}
                  onSigned={() => {
                    void fetchJob();
                    void fetchPhotoCounts();
                    setStep("invoice");
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          <Card className="bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Job Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Time</span>
                <span>{totalMinutes} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Parts Used</span>
                <span>{usedParts.length} items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Checklist</span>
                <span>
                  {checkedItems.filter(Boolean).length}/{checklist.length} done
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === "invoice" && profile?.company_id && (
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardContent className="py-4">
            <JobInvoiceForm
              job={job}
              timeEntries={timeEntries}
              usedParts={usedParts}
              companyId={profile.company_id}
              technicianRate={techRate}
              onInvoiceCreated={() => {
                setHasInvoice(true);
                setStep("invoice");
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Step navigation */}
      <Card className="bg-card/70 backdrop-blur-sm">
        <CardContent className="py-3 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={goPrev}
            disabled={prevStep(currentStep) === null}
          >
            Back
          </Button>
          <div className="flex-1 text-center text-xs text-muted-foreground">
            {JOB_FLOW_STEPS.find((s) => s.id === currentStep)?.description ?? ""}
          </div>
          <Button
            type="button"
            className="gradient-bg hover:opacity-90 shadow-glow"
            onClick={() => void goNext()}
            disabled={!canGoNext}
          >
            {nextStep(currentStep)
              ? `Next: ${JOB_FLOW_STEPS.find((s) => s.id === nextStep(currentStep))?.label ?? "Next"}`
              : "Finish"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
