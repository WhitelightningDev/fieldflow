import { useAuth } from "@/features/auth/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Clock, Navigation } from "lucide-react";
import * as React from "react";

export default function TechDispatch() {
  const { user, profile } = useAuth();
  const [jobs, setJobs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    // Find the technician record linked to this user
    supabase
      .from("technicians")
      .select("id")
      .eq("user_id", user.id)
      .single()
      .then(({ data: tech }) => {
        if (!tech) { setLoading(false); return; }
        supabase
          .from("job_cards")
          .select("*, customers(name), sites(name, address)")
          .eq("technician_id", tech.id)
          .in("status", ["new", "scheduled", "in-progress"])
          .order("scheduled_at", { ascending: true })
          .then(({ data }) => {
            setJobs(data ?? []);
            setLoading(false);
          });
      });
  }, [user]);

  const statusColor: Record<string, string> = {
    new: "bg-blue-500/10 text-blue-700",
    scheduled: "bg-amber-500/10 text-amber-700",
    "in-progress": "bg-green-500/10 text-green-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dispatch</h1>
        <p className="text-muted-foreground text-sm">
          Welcome back, {profile?.full_name || "Technician"}. Here are your active assignments.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Navigation className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <div className="font-medium">No active jobs</div>
            <div className="text-sm mt-1">Check back when new jobs are dispatched to you.</div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{job.title}</CardTitle>
                  <Badge className={statusColor[job.status] ?? ""}>{job.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {job.description && (
                  <p className="text-muted-foreground">{job.description}</p>
                )}
                {(job as any).customers?.name && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium">Customer:</span> {(job as any).customers.name}
                  </div>
                )}
                {(job as any).sites?.name && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {(job as any).sites.name}
                    {(job as any).sites.address && ` — ${(job as any).sites.address}`}
                  </div>
                )}
                {job.scheduled_at && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(job.scheduled_at).toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
