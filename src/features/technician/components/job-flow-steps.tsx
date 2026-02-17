import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

export type JobFlowStep =
  | "arrive"
  | "diagnose"
  | "work"
  | "document"
  | "signoff"
  | "invoice";

export const JOB_FLOW_STEPS: { id: JobFlowStep; label: string; description: string }[] = [
  { id: "arrive", label: "Arrive", description: "Start timer & capture before photos" },
  { id: "diagnose", label: "Diagnose", description: "Review checklist & describe the issue" },
  { id: "work", label: "Work", description: "Log parts used & track time" },
  { id: "document", label: "Document", description: "After photos & job notes" },
  { id: "signoff", label: "Sign-off", description: "Customer signature & complete job" },
  { id: "invoice", label: "Invoice", description: "Create invoice & record payment" },
];

type Props = {
  currentStep: JobFlowStep;
  completedSteps: Set<JobFlowStep>;
  onStepClick: (step: JobFlowStep) => void;
};

export default function JobFlowSteps({ currentStep, completedSteps, onStepClick }: Props) {
  return (
    <div className="flex overflow-x-auto gap-1 pb-2 scrollbar-hide">
      {JOB_FLOW_STEPS.map((step, i) => {
        const isActive = step.id === currentStep;
        const isComplete = completedSteps.has(step.id);
        return (
          <button
            key={step.id}
            onClick={() => onStepClick(step.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-w-0 shrink-0",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : isComplete
                ? "bg-primary/10 text-primary"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            )}
          >
            {isComplete ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            ) : isActive ? (
              <CircleDot className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="hidden sm:inline">{step.label}</span>
            <span className="sm:hidden">{i + 1}</span>
          </button>
        );
      })}
    </div>
  );
}
