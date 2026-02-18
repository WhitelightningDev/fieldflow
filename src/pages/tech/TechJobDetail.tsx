import { useAuth } from "@/features/auth/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import JobTimer from "@/features/technician/components/job-timer";
import JobPhotoUpload from "@/features/technician/components/job-photo-upload";
import JobNotesEditor from "@/features/technician/components/job-notes-editor";
import JobPartsUsed from "@/features/technician/components/job-parts-used";
import SignaturePad from "@/features/technician/components/signature-pad";
import JobFlowSteps, { type JobFlowStep } from "@/features/technician/components/job-flow-steps";
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
  Wrench,
} from "lucide-react";
import * as React from "react";
import { Link, useParams } from "react-router-dom";
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
  if (job.status === "new" || job.status === "scheduled") return "arrive";
  if (job.status === "invoiced" || hasInvoice) return "invoice";
  if (job.status === "completed") return "signoff";
  return "work";
}

function deriveCompleted(job: any, timeEntries: any[], hasBeforePhotos: boolean, hasAfterPhotos: boolean, hasInvoice: boolean): Set<JobFlowStep> {
  const s = new Set<JobFlowStep>();
  if (job.status !== "new" && job.status !== "scheduled") s.add("arrive");
  if (timeEntries.length > 0) s.add("work");
  if (hasBeforePhotos) s.add("arrive");
  if (hasAfterPhotos) s.add("document");
  if (job.status === "completed" || job.status === "invoiced") {
    s.add("arrive");
    s.add("diagnose");
    s.add("work");
    s.add("document");
    s.add("signoff");
  }
  if (hasInvoice) s.add("invoice");
  return s;
}

export default function TechJobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
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
    const [{ count: bCount }, { count: aCount }] = await Promise.all([
      supabase.from("job_photos").select("id", { count: "exact", head: true }).eq("job_card_id", jobId).eq("kind", "before"),
      supabase.from("job_photos").select("id", { count: "exact", head: true }).eq("job_card_id", jobId).eq("kind", "after"),
    ]);
    setBeforePhotoCount(bCount ?? 0);
    setAfterPhotoCount(aCount ?? 0);
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

  // Auto-derive step
  React.useEffect(() => {
    if (!job) return;
    setCurrentStep(deriveStep(job, hasInvoice));
  }, [job, hasInvoice]);

  const completedSteps = job
    ? deriveCompleted(job, timeEntries, beforePhotoCount > 0, afterPhotoCount > 0, hasInvoice)
    : new Set<JobFlowStep>();

  const updateStatus = async (status: string) => {
    if (!jobId) return;
    const { error } = await supabase
      .from("job_cards")
      .update({ status: status as any })
      .eq("id", jobId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setJob((prev: any) => ({ ...prev, status }));
    toast({ title: `Job ${status === "in-progress" ? "started" : status}` });
  };

  const totalMinutes = timeEntries
    .filter((e) => e.minutes != null)
    .reduce((sum, e) => sum + e.minutes, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="gap-1.5">
          <Link to="/tech/my-jobs"><ArrowLeft className="h-4 w-4" /> Back</Link>
        </Button>
        <Card><CardContent className="py-12 text-center text-muted-foreground">Job not found.</CardContent></Card>
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
              <Button size="sm" onClick={() => updateStatus("in-progress")} className="gradient-bg hover:opacity-90 shadow-glow gap-1.5">
                <Play className="h-3.5 w-3.5" /> Start Job
              </Button>
            )}
            {job.status === "in-progress" && (
              <Button size="sm" variant="outline" onClick={() => updateStatus("completed")} className="gap-1.5">
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
      <JobFlowSteps currentStep={currentStep} completedSteps={completedSteps} onStepClick={setCurrentStep} />

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
              <JobPhotoUpload jobId={job.id} kind="before" />
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
              <JobNotesEditor jobId={job.id} initialNotes={job.notes} />
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
                <JobPartsUsed jobId={job.id} siteId={job.site_id} companyId={profile.company_id} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {currentStep === "document" && (
        <div className="space-y-4">
          <Card className="bg-card/70 backdrop-blur-sm">
            <CardContent className="py-4 space-y-6">
              <JobPhotoUpload jobId={job.id} kind="after" />
            </CardContent>
          </Card>

          <Card className="bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <JobNotesEditor jobId={job.id} initialNotes={job.notes} />
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
                  <Button size="sm" variant="outline" onClick={() => updateStatus("completed")} className="gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark Complete
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {(job.status === "completed" || job.status === "invoiced") && (
            <Card className="bg-card/70 backdrop-blur-sm">
              <CardContent className="py-4">
                <SignaturePad jobId={job.id} onSigned={() => fetchJob()} />
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
              onInvoiceCreated={() => setHasInvoice(true)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
