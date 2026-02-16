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
import { Link, useNavigate, useParams } from "react-router-dom";

const statusColor: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  scheduled: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "in-progress": "bg-green-500/10 text-green-700 dark:text-green-400",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  invoiced: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  cancelled: "bg-destructive/10 text-destructive",
};

const priorityColor: Record<string, string> = {
  low: "bg-secondary text-secondary-foreground",
  normal: "bg-secondary text-secondary-foreground",
  high: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  urgent: "bg-destructive/10 text-destructive",
};

export default function TechJobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = React.useState<any>(null);
  const [techId, setTechId] = React.useState<string | null>(null);
  const [timeEntries, setTimeEntries] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchJob = React.useCallback(async () => {
    if (!jobId) return;
    const { data } = await supabase
      .from("job_cards")
      .select("*, customers(name, phone, email, address), sites(name, address)")
      .eq("id", jobId)
      .single();
    setJob(data);
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

  React.useEffect(() => {
    if (!user) return;
    supabase
      .from("technicians")
      .select("id")
      .eq("user_id", user.id)
      .single()
      .then(({ data: tech }) => setTechId(tech?.id ?? null));
  }, [user]);

  React.useEffect(() => {
    fetchJob();
    fetchTimeEntries();
  }, [fetchJob, fetchTimeEntries]);

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
  const checklist = Array.isArray(job.checklist) ? job.checklist : [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="gap-1.5 mb-2 -ml-3">
            <Link to="/tech/my-jobs"><ArrowLeft className="h-4 w-4" /> Back to jobs</Link>
          </Button>
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={statusColor[job.status] ?? ""}>{job.status}</Badge>
            <Badge className={priorityColor[(job as any).priority ?? "normal"] ?? ""}>
              {(job as any).priority ?? "normal"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2 sm:flex-col w-full sm:w-auto">
          {(job.status === "new" || job.status === "scheduled") && (
            <Button size="sm" onClick={() => updateStatus("in-progress")} className="w-full sm:w-auto gradient-bg hover:opacity-90 shadow-glow gap-1.5">
              <Play className="h-3.5 w-3.5" /> Start Job
            </Button>
          )}
          {job.status === "in-progress" && (
            <Button size="sm" variant="outline" onClick={() => updateStatus("completed")} className="w-full sm:w-auto gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Complete
            </Button>
          )}
        </div>
      </div>

      {/* Timer */}
      {techId && (job.status === "in-progress" || job.status === "new" || job.status === "scheduled") && (
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardContent className="py-4">
            <JobTimer jobId={job.id} technicianId={techId} onEntryChange={fetchTimeEntries} />
          </CardContent>
        </Card>
      )}

      {/* Job Info */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Customer */}
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
            {customer?.address && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {customer.address}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Site / Schedule */}
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Navigation className="h-4 w-4 text-muted-foreground" /> Site & Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="font-medium">{site?.name ?? "No site assigned"}</div>
            {site?.address && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {site.address}
              </div>
            )}
            {job.scheduled_at && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {new Date(job.scheduled_at).toLocaleString()}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Wrench className="h-3.5 w-3.5" /> {job.trade_id}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
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

      {/* Checklist */}
      {checklist.length > 0 && (
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {checklist.map((item: string, i: number) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Time Log */}
      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Time Logged — {totalMinutes} min total
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

      <Separator />

      {/* Before/After Photos */}
      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Photos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <JobPhotoUpload jobId={job.id} kind="before" />
          <Separator />
          <JobPhotoUpload jobId={job.id} kind="after" />
        </CardContent>
      </Card>

      {/* Parts Used */}
      {profile?.company_id && (
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardContent className="py-4">
            <JobPartsUsed jobId={job.id} siteId={job.site_id} companyId={profile.company_id} />
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <JobNotesEditor jobId={job.id} initialNotes={job.notes} />
        </CardContent>
      </Card>

      {/* Signature */}
      {job.status === "completed" && (
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardContent className="py-4">
            <SignaturePad jobId={job.id} onSigned={() => fetchJob()} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
