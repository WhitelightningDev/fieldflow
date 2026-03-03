import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Save } from "lucide-react";
import * as React from "react";

type Props = { jobId: string; initialNotes: string | null };

type ExtendedProps = Props & {
  onSaved?: () => void;
};

const TECH_DELIM = "\n--- TECH NOTES ---\n";

function parseStructuredNotes(raw: string) {
  const notes = String(raw ?? "");
  const idx = notes.indexOf(TECH_DELIM);
  if (idx !== -1) {
    const requestBlock = notes.slice(0, idx).trimEnd();
    const techNotes = notes.slice(idx + TECH_DELIM.length).trim();
    return { kind: "structured" as const, requestBlock, techNotes };
  }
  if (/origin:\s*quote request\s+[0-9a-f-]{36}/i.test(notes) || /^quote request:/i.test(notes)) {
    return { kind: "structured" as const, requestBlock: notes.trimEnd(), techNotes: "" };
  }
  return { kind: "plain" as const, notes };
}

export default function JobNotesEditor({ jobId, initialNotes, onSaved }: ExtendedProps) {
  const [mode, setMode] = React.useState<ReturnType<typeof parseStructuredNotes>>(() => parseStructuredNotes(initialNotes ?? ""));
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setMode(parseStructuredNotes(initialNotes ?? ""));
  }, [initialNotes]);

  const save = async () => {
    setSaving(true);
    const toSave =
      mode.kind === "structured"
        ? `${mode.requestBlock.trimEnd()}${TECH_DELIM}${mode.techNotes.trim()}`
        : mode.notes;
    const { error } = await supabase
      .from("job_cards")
      .update({ notes: toSave } as any)
      .eq("id", jobId);
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Notes saved" });
    onSaved?.();
  };

  return (
    <div className="space-y-2">
      {mode.kind === "structured" ? (
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium">Request details</div>
            <div className="mt-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">
              {mode.requestBlock.trim() ? mode.requestBlock.trim() : "—"}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              This section is read-only. Add your diagnosis and work notes below.
            </div>
          </div>

          <div className="space-y-1">
            <Label>Technician notes</Label>
            <Textarea
              value={mode.techNotes}
              onChange={(e) => setMode((prev) => (prev.kind === "structured" ? { ...prev, techNotes: e.target.value } : prev))}
              rows={5}
              placeholder="Add your diagnosis, findings, and next steps…"
            />
          </div>
        </div>
      ) : (
        <Textarea
          value={mode.notes}
          onChange={(e) => setMode((prev) => (prev.kind === "plain" ? { ...prev, notes: e.target.value } : prev))}
          rows={5}
          placeholder="Add notes about the job…"
        />
      )}
      <Button size="sm" variant="outline" onClick={save} disabled={saving} className="gap-1.5">
        <Save className="h-3.5 w-3.5" />
        {saving ? "Saving…" : "Save Notes"}
      </Button>
    </div>
  );
}
