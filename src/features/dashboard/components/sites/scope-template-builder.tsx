import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import * as React from "react";

export type ScopeTemplateV1 = {
  v: 1;
  stages: Array<{
    id: string;
    name: string;
    jobs: Array<{ id: string; title: string }>;
  }>;
};

function createId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export function normalizeScopeTemplate(template: ScopeTemplateV1 | null): ScopeTemplateV1 | null {
  if (!template) return null;
  const stages = (template.stages ?? [])
    .map((s) => ({
      ...s,
      name: String(s.name ?? "").trim(),
      jobs: (s.jobs ?? [])
        .map((j) => ({ ...j, title: String(j.title ?? "").trim() }))
        .filter((j) => j.title.length > 0),
    }))
    .filter((s) => s.name.length > 0 || s.jobs.length > 0);

  if (stages.length === 0) return null;
  return { v: 1, stages };
}

export function parseScopeTemplateV1(input: unknown): ScopeTemplateV1 | null {
  if (!input || typeof input !== "object") return null;
  const v = (input as any).v;
  if (v !== 1) return null;
  const stagesRaw = (input as any).stages;
  if (!Array.isArray(stagesRaw)) return null;
  const stages = stagesRaw
    .map((s: any) => {
      const id = String(s?.id ?? "");
      const name = String(s?.name ?? "");
      const jobsRaw = s?.jobs;
      const jobs = Array.isArray(jobsRaw)
        ? jobsRaw.map((j: any) => ({ id: String(j?.id ?? ""), title: String(j?.title ?? "") }))
        : [];
      return { id: id || createId(), name, jobs: jobs.map((j) => ({ ...j, id: j.id || createId() })) };
    });
  return normalizeScopeTemplate({ v: 1, stages });
}

type Props = {
  value: ScopeTemplateV1 | null;
  onChange: (next: ScopeTemplateV1 | null) => void;
  className?: string;
};

export default function ScopeTemplateBuilder({ value, onChange, className }: Props) {
  const template = value ?? { v: 1 as const, stages: [] };

  const addStage = () => {
    const nextIdx = template.stages.length + 1;
    const next: ScopeTemplateV1 = {
      v: 1,
      stages: [
        ...template.stages,
        { id: createId(), name: `Stage ${nextIdx}`, jobs: [] },
      ],
    };
    onChange(normalizeScopeTemplate(next));
  };

  const updateStage = (stageId: string, patch: Partial<ScopeTemplateV1["stages"][number]>) => {
    const next: ScopeTemplateV1 = {
      v: 1,
      stages: template.stages.map((s) => (s.id === stageId ? { ...s, ...patch } : s)),
    };
    onChange(normalizeScopeTemplate(next));
  };

  const removeStage = (stageId: string) => {
    const next: ScopeTemplateV1 = { v: 1, stages: template.stages.filter((s) => s.id !== stageId) };
    onChange(normalizeScopeTemplate(next));
  };

  const addJobToStage = (stageId: string, title: string) => {
    const t = title.trim();
    if (!t) return;
    const stage = template.stages.find((s) => s.id === stageId);
    if (!stage) return;
    const exists = stage.jobs.some((j) => j.title.toLowerCase().trim() === t.toLowerCase());
    if (exists) return;
    updateStage(stageId, { jobs: [...stage.jobs, { id: createId(), title: t }] });
  };

  const removeJobFromStage = (stageId: string, jobId: string) => {
    const stage = template.stages.find((s) => s.id === stageId);
    if (!stage) return;
    updateStage(stageId, { jobs: stage.jobs.filter((j) => j.id !== jobId) });
  };

  return (
    <Card className={cn("bg-card/70", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Scope template (optional)</CardTitle>
        <div className="text-xs text-muted-foreground">
          Break work into stages with suggested job cards. This helps admins create consistent job cards per site.
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {template.stages.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            No stages yet. Add a stage to start building a list of suggested job cards.
          </div>
        ) : (
          <div className="space-y-3">
            {template.stages.map((stage) => (
              <StageEditor
                key={stage.id}
                stage={stage}
                onRename={(name) => updateStage(stage.id, { name })}
                onRemove={() => removeStage(stage.id)}
                onAddJob={(title) => addJobToStage(stage.id, title)}
                onRemoveJob={(jobId) => removeJobFromStage(stage.id, jobId)}
              />
            ))}
          </div>
        )}

        <Button type="button" size="sm" variant="outline" onClick={addStage} className="gap-1.5 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Add stage
        </Button>
      </CardContent>
    </Card>
  );
}

function StageEditor({
  stage,
  onRename,
  onRemove,
  onAddJob,
  onRemoveJob,
}: {
  stage: ScopeTemplateV1["stages"][number];
  onRename: (name: string) => void;
  onRemove: () => void;
  onAddJob: (title: string) => void;
  onRemoveJob: (jobId: string) => void;
}) {
  const [draft, setDraft] = React.useState("");

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex-1">
          <Input
            value={stage.name}
            onChange={(e) => onRename(e.target.value)}
            placeholder="Stage name (e.g. Stage 1)"
            className="h-9"
          />
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onRemove} className="gap-1.5 sm:w-auto w-full">
          <Trash2 className="h-4 w-4" />
          Remove stage
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a suggested job (e.g. Install DB board)"
          className="h-9"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const t = draft.trim();
              if (!t) return;
              onAddJob(t);
              setDraft("");
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            const t = draft.trim();
            if (!t) return;
            onAddJob(t);
            setDraft("");
          }}
          className="gap-1.5 w-full sm:w-auto"
          disabled={draft.trim().length === 0}
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {stage.jobs.length > 0 ? (
        <div className="space-y-1.5">
          {stage.jobs.map((j) => (
            <div key={j.id} className="flex items-center justify-between gap-2 rounded-md bg-secondary/40 px-3 py-2">
              <div className="text-sm min-w-0">
                <div className="truncate">{j.title}</div>
              </div>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => onRemoveJob(j.id)} aria-label="Remove job">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          No suggested jobs yet.
        </div>
      )}
    </div>
  );
}

