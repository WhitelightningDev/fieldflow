import { useAuth } from "@/features/auth/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Briefcase, CheckCircle2 } from "lucide-react";
import * as React from "react";

const STATUSES = ["new", "scheduled", "in-progress", "completed"] as const;

export default function TechMyJobs() {
  const { user } = useAuth();
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
          .order("updated_at", { ascending: false })
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
    toast({ title: `Job status updated to ${status}` });
  };

  const statusColor: Record<string, string> = {
    new: "bg-blue-500/10 text-blue-700",
    scheduled: "bg-amber-500/10 text-amber-700",
    "in-progress": "bg-green-500/10 text-green-700",
    completed: "bg-emerald-500/10 text-emerald-700",
    invoiced: "bg-purple-500/10 text-purple-700",
    cancelled: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Jobs</h1>
        <p className="text-muted-foreground text-sm">All jobs assigned to you.</p>
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
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{job.title}</CardTitle>
                    {job.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{job.description}</p>
                    )}
                  </div>
                  <Badge className={statusColor[job.status] ?? ""}>{job.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 flex-wrap">
                  <Select
                    value={job.status}
                    onValueChange={(v) => updateStatus(job.id, v)}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {job.status !== "completed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(job.id, "completed")}
                      className="gap-1"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Complete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
