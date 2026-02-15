import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Save } from "lucide-react";
import * as React from "react";

type Props = { jobId: string; initialNotes: string | null };

export default function JobNotesEditor({ jobId, initialNotes }: Props) {
  const [notes, setNotes] = React.useState(initialNotes ?? "");
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("job_cards")
      .update({ notes } as any)
      .eq("id", jobId);
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Notes saved" });
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="Add notes about the job…"
      />
      <Button size="sm" variant="outline" onClick={save} disabled={saving} className="gap-1.5">
        <Save className="h-3.5 w-3.5" />
        {saving ? "Saving…" : "Save Notes"}
      </Button>
    </div>
  );
}
