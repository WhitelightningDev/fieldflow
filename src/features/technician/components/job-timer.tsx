import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Play, Square, Timer } from "lucide-react";
import * as React from "react";

type Props = {
  jobId: string;
  technicianId: string;
  onEntryChange?: () => void;
};

export default function JobTimer({ jobId, technicianId, onEntryChange }: Props) {
  const [activeEntry, setActiveEntry] = React.useState<any>(null);
  const [elapsed, setElapsed] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  // Fetch active time entry
  React.useEffect(() => {
    supabase
      .from("job_time_entries")
      .select("*")
      .eq("job_card_id", jobId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setActiveEntry(data?.[0] ?? null);
        setLoading(false);
      });
  }, [jobId]);

  // Tick elapsed time
  React.useEffect(() => {
    if (!activeEntry) { setElapsed(0); return; }
    const tick = () => {
      const started = new Date(activeEntry.started_at).getTime();
      setElapsed(Math.floor((Date.now() - started) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeEntry]);

  const startTimer = async () => {
    const { data: entry, error } = await supabase
      .from("job_time_entries")
      .insert({ job_card_id: jobId, technician_id: technicianId, started_at: new Date().toISOString() })
      .select()
      .single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setActiveEntry(entry);
    onEntryChange?.();
    toast({ title: "Timer started" });
  };

  const stopTimer = async () => {
    if (!activeEntry) return;
    const now = new Date();
    const started = new Date(activeEntry.started_at);
    const minutes = Math.round((now.getTime() - started.getTime()) / 60000);
    const { error } = await supabase
      .from("job_time_entries")
      .update({ ended_at: now.toISOString(), minutes })
      .eq("id", activeEntry.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setActiveEntry(null);
    setElapsed(0);
    onEntryChange?.();
    toast({ title: `Timer stopped — ${minutes} min logged` });
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  if (loading) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 font-mono text-lg">
        <Timer className="h-5 w-5 text-muted-foreground" />
        <span className={activeEntry ? "text-primary font-bold" : "text-muted-foreground"}>
          {formatTime(elapsed)}
        </span>
      </div>
      {activeEntry ? (
        <Button size="sm" variant="destructive" onClick={stopTimer} className="gap-1.5">
          <Square className="h-3.5 w-3.5" />
          Stop
        </Button>
      ) : (
        <Button size="sm" onClick={startTimer} className="gradient-bg hover:opacity-90 shadow-glow gap-1.5">
          <Play className="h-3.5 w-3.5" />
          Start Timer
        </Button>
      )}
    </div>
  );
}
