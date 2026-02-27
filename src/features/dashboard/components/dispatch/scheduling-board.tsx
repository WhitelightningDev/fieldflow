import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import type { DashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { addDays, format, isSameDay, startOfDay, startOfWeek, setHours, isWithinInterval, differenceInMinutes } from "date-fns";
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, GripVertical, User } from "lucide-react";
import * as React from "react";

type JobCard = Tables<"job_cards">;
type Technician = Tables<"technicians">;

type Props = {
  jobs: JobCard[];
  technicians: Technician[];
  customersById: Map<string, Tables<"customers">>;
  sitesById: Map<string, Tables<"sites">>;
  onReschedule: (jobId: string, scheduledAt: string, technicianId: string | null) => Promise<void>;
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 6); // 6am-5pm
const HOUR_WIDTH = 120;
const ROW_HEIGHT = 80;
const SLOT_MINUTES = 60;

const priorityColors: Record<string, string> = {
  emergency: "bg-destructive/20 border-destructive/50 text-destructive",
  urgent: "bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-400",
  normal: "bg-primary/10 border-primary/30 text-primary",
};

const statusIndicator: Record<string, string> = {
  new: "bg-blue-500",
  scheduled: "bg-amber-500",
  "in-progress": "bg-green-500",
  completed: "bg-emerald-600",
  invoiced: "bg-purple-500",
  cancelled: "bg-muted-foreground",
};

export default function SchedulingBoard({ jobs, technicians, customersById, sitesById, onReschedule }: Props) {
  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = React.useState(() => startOfDay(new Date()));
  const [dragJobId, setDragJobId] = React.useState<string | null>(null);

  const days = React.useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const activeTechs = React.useMemo(() => technicians.filter((t) => t.active), [technicians]);

  // Jobs for selected day
  const dayJobs = React.useMemo(() => {
    return jobs.filter((j) => {
      if (!j.scheduled_at) return false;
      return isSameDay(new Date(j.scheduled_at), selectedDay);
    });
  }, [jobs, selectedDay]);

  // Unscheduled jobs (no date or no technician)
  const unscheduledJobs = React.useMemo(() => {
    return jobs.filter((j) => !j.scheduled_at && !["completed", "invoiced", "cancelled"].includes(j.status));
  }, [jobs]);

  // Tech capacity: count jobs per tech for the day
  const techJobCount = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const j of dayJobs) {
      if (!j.technician_id) continue;
      m.set(j.technician_id, (m.get(j.technician_id) ?? 0) + 1);
    }
    return m;
  }, [dayJobs]);

  // Jobs per tech for the selected day
  const jobsByTech = React.useMemo(() => {
    const m = new Map<string | "__unassigned__", JobCard[]>();
    m.set("__unassigned__", []);
    for (const t of activeTechs) m.set(t.id, []);

    for (const j of dayJobs) {
      const key = j.technician_id ?? "__unassigned__";
      const arr = m.get(key) ?? [];
      arr.push(j);
      m.set(key, arr);
    }
    return m;
  }, [dayJobs, activeTechs]);

  const getJobPosition = (job: JobCard) => {
    if (!job.scheduled_at) return null;
    const d = new Date(job.scheduled_at);
    const hour = d.getHours();
    const minute = d.getMinutes();
    if (hour < 6 || hour > 17) return null;
    const left = (hour - 6) * HOUR_WIDTH + (minute / 60) * HOUR_WIDTH;
    const width = Math.max(HOUR_WIDTH * 0.9, HOUR_WIDTH); // Default 1hr block
    return { left, width };
  };

  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    setDragJobId(jobId);
    e.dataTransfer.setData("text/plain", jobId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e: React.DragEvent, techId: string | null, hour: number) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData("text/plain");
    if (!jobId) return;
    setDragJobId(null);

    const scheduledAt = setHours(selectedDay, hour).toISOString();
    await onReschedule(jobId, scheduledAt, techId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const MAX_CAPACITY = 6; // SLA: max jobs per tech per day

  return (
    <Card className="bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-sm">Dispatch board</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart((w) => addDays(w, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => { setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })); setSelectedDay(startOfDay(new Date())); }}>
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart((w) => addDays(w, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Week day picker */}
        <div className="flex gap-1 mt-2">
          {days.map((d) => {
            const isSelected = isSameDay(d, selectedDay);
            const isCurrentDay = isSameDay(d, new Date());
            const dayJobCount = jobs.filter((j) => j.scheduled_at && isSameDay(new Date(j.scheduled_at), d)).length;
            return (
              <Button
                key={d.toISOString()}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                className={`flex-1 flex-col h-auto py-1.5 gap-0 ${isCurrentDay && !isSelected ? "border-primary/50" : ""}`}
                onClick={() => setSelectedDay(startOfDay(d))}
              >
                <span className="text-[10px] uppercase">{format(d, "EEE")}</span>
                <span className="text-sm font-bold">{format(d, "d")}</span>
                {dayJobCount > 0 && <span className="text-[10px] opacity-70">{dayJobCount} jobs</span>}
              </Button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Timeline grid */}
        <ScrollArea className="w-full">
          <div className="min-w-[900px]">
            {/* Hour headers */}
            <div className="flex border-b border-border/50 ml-[140px]">
              {HOURS.map((h) => (
                <div key={h} className="text-[10px] text-muted-foreground font-medium text-center border-l border-border/30" style={{ width: HOUR_WIDTH }}>
                  {format(setHours(new Date(), h), "ha")}
                </div>
              ))}
            </div>

            {/* Tech rows */}
            {activeTechs.map((tech) => {
              const count = techJobCount.get(tech.id) ?? 0;
              const capacityPercent = Math.min((count / MAX_CAPACITY) * 100, 100);
              const isOverloaded = count >= MAX_CAPACITY;
              const techJobs = jobsByTech.get(tech.id) ?? [];

              return (
                <div key={tech.id} className="flex border-b border-border/20 group">
                  {/* Tech label */}
                  <div className="w-[140px] shrink-0 p-2 flex flex-col justify-center border-r border-border/30">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium truncate">{tech.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isOverloaded ? "bg-destructive" : capacityPercent > 60 ? "bg-amber-500" : "bg-primary"}`}
                          style={{ width: `${capacityPercent}%` }}
                        />
                      </div>
                      <span className={`text-[10px] ${isOverloaded ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {count}/{MAX_CAPACITY}
                      </span>
                    </div>
                  </div>

                  {/* Timeline slots */}
                  <div className="flex relative" style={{ height: ROW_HEIGHT }}>
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="border-l border-border/20 hover:bg-muted/30 transition-colors cursor-pointer"
                        style={{ width: HOUR_WIDTH, height: ROW_HEIGHT }}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, tech.id, h)}
                      />
                    ))}

                    {/* Job blocks */}
                    {techJobs.map((job) => {
                      const pos = getJobPosition(job);
                      if (!pos) return null;
                      const customer = customersById.get(job.customer_id ?? "");
                      const site = sitesById.get(job.site_id ?? "");
                      const colorClass = priorityColors[job.priority] ?? priorityColors.normal;

                      return (
                        <TooltipProvider key={job.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                draggable
                                onDragStart={(e) => handleDragStart(e, job.id)}
                                className={`absolute top-1 rounded-md border px-2 py-1 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md ${colorClass} ${dragJobId === job.id ? "opacity-50" : ""}`}
                                style={{ left: pos.left, width: pos.width - 4, height: ROW_HEIGHT - 8 }}
                              >
                                <div className="flex items-center gap-1">
                                  <GripVertical className="h-3 w-3 opacity-40 shrink-0" />
                                  <div className={`h-2 w-2 rounded-full shrink-0 ${statusIndicator[job.status] ?? "bg-muted"}`} />
                                  <span className="text-[11px] font-medium truncate">{job.title}</span>
                                </div>
                                <div className="text-[10px] opacity-70 truncate mt-0.5">
                                  {customer?.name ?? "No customer"} {site ? `· ${site.name}` : ""}
                                </div>
                                <div className="text-[10px] opacity-60 truncate">
                                  {job.scheduled_at ? format(new Date(job.scheduled_at), "h:mm a") : ""}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-1">
                                <div className="font-medium">{job.title}</div>
                                <div className="text-xs">{job.description || "No description"}</div>
                                <div className="text-xs text-muted-foreground">
                                  {customer?.name ?? "No customer"} · {site?.name ?? "No site"} · {job.status}
                                </div>
                                {job.priority !== "normal" && (
                                  <Badge variant="destructive" className="text-[10px]">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    {job.priority}
                                  </Badge>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Unassigned row */}
            {(jobsByTech.get("__unassigned__")?.length ?? 0) > 0 && (
              <div className="flex border-b border-border/20">
                <div className="w-[140px] shrink-0 p-2 flex flex-col justify-center border-r border-border/30">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Unassigned</span>
                  </div>
                </div>
                <div className="flex relative" style={{ height: ROW_HEIGHT }}>
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="border-l border-border/20 hover:bg-amber-500/5 transition-colors"
                      style={{ width: HOUR_WIDTH, height: ROW_HEIGHT }}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, null, h)}
                    />
                  ))}
                  {(jobsByTech.get("__unassigned__") ?? []).map((job) => {
                    const pos = getJobPosition(job);
                    if (!pos) return null;
                    return (
                      <div
                        key={job.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, job.id)}
                        className={`absolute top-1 rounded-md border px-2 py-1 cursor-grab active:cursor-grabbing bg-amber-500/10 border-amber-500/30 ${dragJobId === job.id ? "opacity-50" : ""}`}
                        style={{ left: pos.left, width: pos.width - 4, height: ROW_HEIGHT - 8 }}
                      >
                        <div className="flex items-center gap-1">
                          <GripVertical className="h-3 w-3 opacity-40" />
                          <span className="text-[11px] font-medium truncate text-amber-700 dark:text-amber-400">{job.title}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Unscheduled jobs pool */}
        {unscheduledJobs.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Unscheduled ({unscheduledJobs.length}) — drag onto the board
            </div>
            <div className="flex flex-wrap gap-2">
              {unscheduledJobs.slice(0, 20).map((job) => {
                const customer = customersById.get(job.customer_id ?? "");
                const colorClass = priorityColors[job.priority] ?? priorityColors.normal;
                return (
                  <div
                    key={job.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, job.id)}
                    className={`rounded-md border px-2.5 py-1.5 cursor-grab active:cursor-grabbing text-xs ${colorClass} ${dragJobId === job.id ? "opacity-50" : ""}`}
                  >
                    <div className="font-medium">{job.title}</div>
                    <div className="opacity-70 text-[10px]">{customer?.name ?? "No customer"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SLA legend */}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-2 border-t border-border/30">
          <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-primary" /> Normal</span>
          <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-amber-500" /> Urgent</span>
          <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-destructive" /> Emergency</span>
          <span className="ml-auto">Max {MAX_CAPACITY} jobs/tech/day (SLA)</span>
        </div>
      </CardContent>
    </Card>
  );
}
