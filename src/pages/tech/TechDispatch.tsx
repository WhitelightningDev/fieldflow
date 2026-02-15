import { useAuth } from "@/features/auth/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import {
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileSignature,
  MapPin,
  Navigation,
  Play,
} from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";

function isToday(dateStr: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export default function TechDispatch() {
  const { user, profile } = useAuth();
  const [jobs, setJobs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [techId, setTechId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    supabase
      .from("technicians")
      .select("id")
      .eq("user_id", user.id)
      .single()
      .then(({ data: tech }) => {
        if (!tech) { setLoading(false); return; }
        setTechId(tech.id);
        supabase
          .from("job_cards")
          .select("*, customers(name), sites(name, address)")
          .eq("technician_id", tech.id)
          .order("scheduled_at", { ascending: true })
          .then(({ data }) => {
            setJobs(data ?? []);
            setLoading(false);
          });
      });
  }, [user]);

  const updateStatus = async (jobId: string, status: string) => {
    const { error } = await supabase
      .from("job_cards")
      .update({ status: status as any })
      .eq("id", jobId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status, updated_at: new Date().toISOString() } : j)),
    );
    toast({ title: `Job ${status === "in-progress" ? "started" : "updated"}` });
  };

  const todayJobs = jobs.filter((j) => isToday(j.scheduled_at) && !["completed", "invoiced", "cancelled"].includes(j.status));
  const completedJobs = jobs.filter((j) => j.status === "completed" || j.status === "invoiced");
  const pendingSignatures = jobs.filter((j) => j.status === "completed"); // completed but not invoiced = needs signature
  const activeJobs = jobs.filter((j) => ["new", "scheduled", "in-progress"].includes(j.status));

  const statusColor: Record<string, string> = {
    new: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    scheduled: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    "in-progress": "bg-green-500/10 text-green-700 dark:text-green-400",
    completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    invoiced: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
    cancelled: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome, {profile?.full_name || "Technician"}
        </h1>
        <p className="text-muted-foreground text-sm">Your dispatch board for today.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-card/70 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" /> My Jobs Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todayJobs.length}</div>
              </CardContent>
            </Card>

            <Card className="bg-card/70 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Play className="h-3.5 w-3.5" /> Active
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeJobs.length}</div>
              </CardContent>
            </Card>

            <Card className="bg-card/70 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completedJobs.length}</div>
              </CardContent>
            </Card>

            <Card className="bg-card/70 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <FileSignature className="h-3.5 w-3.5" /> Pending Signatures
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{pendingSignatures.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Today's Jobs */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Today's Jobs</h2>
            {todayJobs.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Navigation className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <div className="font-medium">No jobs scheduled for today</div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {todayJobs.map((job) => (
                  <Link key={job.id} to={`/tech/job/${job.id}`} className="block">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">{job.title}</span>
                              <Badge className={statusColor[job.status] ?? ""}>{job.status}</Badge>
                            </div>
                            {job.description && (
                              <p className="text-sm text-muted-foreground mb-2">{job.description}</p>
                            )}
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {(job as any).customers?.name && (
                                <span>Customer: {(job as any).customers.name}</span>
                              )}
                              {(job as any).sites?.name && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {(job as any).sites.name}
                                </span>
                              )}
                              {job.scheduled_at && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(job.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            {job.status === "new" || job.status === "scheduled" ? (
                              <Button
                                size="sm"
                                onClick={(e) => { e.preventDefault(); updateStatus(job.id, "in-progress"); }}
                                className="gradient-bg hover:opacity-90 shadow-glow gap-1"
                              >
                                <Play className="h-3.5 w-3.5" />
                                Start Job
                              </Button>
                            ) : job.status === "in-progress" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => { e.preventDefault(); updateStatus(job.id, "completed"); }}
                                className="gap-1"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Complete
                              </Button>
                            ) : null}
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* All Active Jobs (not just today) */}
          {activeJobs.filter((j) => !isToday(j.scheduled_at)).length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Upcoming Jobs</h2>
              <div className="space-y-3">
                {activeJobs
                  .filter((j) => !isToday(j.scheduled_at))
                  .map((job) => (
                    <Card key={job.id}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{job.title}</span>
                              <Badge variant="outline" className="text-[10px]">{job.status}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {job.scheduled_at && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(job.scheduled_at).toLocaleDateString()}
                                </span>
                              )}
                              {(job as any).sites?.name && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {(job as any).sites.name}
                                </span>
                              )}
                            </div>
                          </div>
                          {(job.status === "new" || job.status === "scheduled") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(job.id, "in-progress")}
                              className="gap-1 shrink-0"
                            >
                              <Play className="h-3.5 w-3.5" />
                              Start
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {/* Completed Jobs */}
          {completedJobs.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Completed Jobs</h2>
              <div className="space-y-2">
                {completedJobs.slice(0, 5).map((job) => (
                  <Card key={job.id} className="opacity-75">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">{job.title}</span>
                        </div>
                        <Badge className={statusColor[job.status] ?? ""} variant="secondary">
                          {job.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {completedJobs.length > 5 && (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    +{completedJobs.length - 5} more completed jobs
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
