import { useAuth } from "@/features/auth/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { Briefcase, CheckCircle2, ChevronRight, Clock, MapPin, Phone } from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";
import { useRealtimeRefetch } from "@/hooks/use-realtime-refetch";

const statusColor: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  scheduled: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "in-progress": "bg-green-500/10 text-green-700 dark:text-green-400",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  invoiced: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function TechMyJobs() {
  const { user, profile } = useAuth();
  const [jobs, setJobs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refreshJobs = React.useCallback(async () => {
    if (!user?.id) return;

    const { data: tech, error: techErr } = await supabase
      .from("technicians")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (techErr) {
      toast({ title: "Could not load technician", description: techErr.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    if (!tech?.id) {
      setJobs([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("job_cards")
      .select("*, customers(name, phone), sites(name, address)")
      .eq("technician_id", tech.id)
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "Could not load jobs", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setJobs(data ?? []);
    setLoading(false);
  }, [user?.id]);

  React.useEffect(() => {
    setLoading(true);
    void refreshJobs();
  }, [refreshJobs]);

  useRealtimeRefetch({
    enabled: Boolean(profile?.company_id),
    channelName: `tech-myjobs:job_cards:${profile?.company_id ?? "none"}`,
    table: "job_cards",
    filter: profile?.company_id ? `company_id=eq.${profile.company_id}` : undefined,
    debounceMs: 1200,
    onRefetch: refreshJobs,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Jobs</h1>
        <p className="text-muted-foreground text-sm">All jobs assigned to you. Tap a job for full details.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <div className="font-medium">No jobs assigned yet</div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const customer = (job as any).customers;
            const site = (job as any).sites;
            return (
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
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{job.description}</p>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {customer?.name && <span>Customer: {customer.name}</span>}
                          {site?.name && (
                            <span className="flex items-center gap-1 min-w-0">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{site.name}</span>
                            </span>
                          )}
                          {job.scheduled_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(job.scheduled_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
