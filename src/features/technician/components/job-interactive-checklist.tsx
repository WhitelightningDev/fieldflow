import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import * as React from "react";

type Props = {
  jobId: string;
  checklist: string[];
  checkedItems: boolean[];
  onUpdate: (checked: boolean[]) => void;
};

export default function JobInteractiveChecklist({ jobId, checklist, checkedItems, onUpdate }: Props) {
  const toggle = async (index: number) => {
    const updated = [...checkedItems];
    updated[index] = !updated[index];
    onUpdate(updated);

    // Persist the checked state in job_cards.checklist as objects
    const checklistData = checklist.map((item, i) => ({
      label: item,
      checked: updated[i] ?? false,
    }));

    const { error } = await supabase
      .from("job_cards")
      .update({ checklist: checklistData as any })
      .eq("id", jobId);

    if (error) {
      toast({ title: "Error saving checklist", description: error.message, variant: "destructive" });
    }
  };

  const completed = checkedItems.filter(Boolean).length;
  const total = checklist.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (total === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Checklist</h4>
        <span className="text-xs text-muted-foreground">
          {completed}/{total} ({pct}%)
        </span>
      </div>
      <div className="w-full bg-secondary rounded-full h-1.5">
        <div
          className="bg-primary h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="space-y-2">
        {checklist.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Checkbox
              checked={checkedItems[i] ?? false}
              onCheckedChange={() => toggle(i)}
              className="mt-0.5"
            />
            <span className={`text-sm ${checkedItems[i] ? "line-through text-muted-foreground" : ""}`}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
