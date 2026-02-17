import { AlertCircle, Camera, FileText, Package, PenLine, Timer } from "lucide-react";
import type { JobFlowStep } from "./job-flow-steps";

const prompts: Record<JobFlowStep, { icon: React.ReactNode; text: string; color: string }[]> = {
  arrive: [
    { icon: <Timer className="h-4 w-4" />, text: "Start your timer to track labour", color: "text-primary" },
    { icon: <Camera className="h-4 w-4" />, text: "Capture before photos of the site/issue", color: "text-amber-600 dark:text-amber-400" },
  ],
  diagnose: [
    { icon: <FileText className="h-4 w-4" />, text: "Review & check off each checklist item", color: "text-primary" },
    { icon: <PenLine className="h-4 w-4" />, text: "Add notes describing the fault or diagnosis", color: "text-muted-foreground" },
  ],
  work: [
    { icon: <Package className="h-4 w-4" />, text: "Log all parts and materials used", color: "text-primary" },
    { icon: <Timer className="h-4 w-4" />, text: "Keep your timer running while working", color: "text-muted-foreground" },
  ],
  document: [
    { icon: <Camera className="h-4 w-4" />, text: "Take after photos showing completed work", color: "text-primary" },
    { icon: <PenLine className="h-4 w-4" />, text: "Update notes with work performed", color: "text-muted-foreground" },
  ],
  signoff: [
    { icon: <Timer className="h-4 w-4" />, text: "Stop your timer before getting sign-off", color: "text-amber-600 dark:text-amber-400" },
    { icon: <PenLine className="h-4 w-4" />, text: "Get the customer's signature to confirm completion", color: "text-primary" },
  ],
  invoice: [
    { icon: <FileText className="h-4 w-4" />, text: "Review auto-calculated invoice from job data", color: "text-primary" },
    { icon: <AlertCircle className="h-4 w-4" />, text: "Record payment received and send invoice", color: "text-muted-foreground" },
  ],
};

export default function JobFlowPrompts({ step }: { step: JobFlowStep }) {
  const items = prompts[step];
  if (!items?.length) return null;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
      <p className="text-xs font-semibold text-primary uppercase tracking-wider">Next steps</p>
      {items.map((item, i) => (
        <div key={i} className={`flex items-center gap-2 text-sm ${item.color}`}>
          {item.icon}
          <span>{item.text}</span>
        </div>
      ))}
    </div>
  );
}
