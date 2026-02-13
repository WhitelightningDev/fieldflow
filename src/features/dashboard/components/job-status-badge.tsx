import { Badge } from "@/components/ui/badge";
import type { JobCardStatus } from "@/features/dashboard/types/job-card";

const LABELS: Record<JobCardStatus, string> = {
  new: "New",
  scheduled: "Scheduled",
  "in-progress": "In progress",
  completed: "Completed",
  invoiced: "Invoiced",
  cancelled: "Cancelled",
};

const VARIANTS: Record<JobCardStatus, "default" | "secondary" | "destructive" | "outline"> = {
  new: "secondary",
  scheduled: "outline",
  "in-progress": "default",
  completed: "secondary",
  invoiced: "default",
  cancelled: "destructive",
};

export default function JobStatusBadge({ status }: { status: JobCardStatus }) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>;
}

