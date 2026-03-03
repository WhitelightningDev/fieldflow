import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import JobStatusBadge from "@/features/dashboard/components/job-status-badge";
import { ArrowUpRight, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import * as React from "react";

type JobCard = Tables<"job_cards">;
type Technician = Tables<"technicians">;

export function RecentJobsCard({
  jobs,
  technicians,
}: {
  jobs: JobCard[];
  technicians: Technician[];
}) {
  const techById = React.useMemo(() => new Map(technicians.map((t) => [t.id, t])), [technicians]);

  const recent = React.useMemo(() => {
    return [...jobs]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 6);
  }, [jobs]);

  return (
    <Card className="shadow-sm border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            Recent Activity
          </span>
          <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0">
            <Link to="/dashboard/jobs">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No recent jobs</p>
        ) : (
          <div className="space-y-0">
            {recent.map((job, idx) => {
              const tech = job.technician_id ? techById.get(job.technician_id) : null;
              return (
                <React.Fragment key={job.id}>
                  <div className="flex items-start gap-3 py-2.5">
                    <div className="mt-1 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Briefcase className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{job.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {tech?.name ?? "Unassigned"} · {format(new Date(job.updated_at), "MMM d, p")}
                          </p>
                        </div>
                        <JobStatusBadge status={job.status} />
                      </div>
                    </div>
                  </div>
                  {idx < recent.length - 1 && <Separator />}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
