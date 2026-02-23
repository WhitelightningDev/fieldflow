import { type LucideIcon, BadgeCheck, BadgeAlert, BadgeX } from "lucide-react";

export type ComplianceState = "verified" | "in_progress" | "unverified";

export function getComplianceState(args: { status?: unknown; progress?: unknown }): {
  state: ComplianceState;
  progress: number;
  label: string;
  icon: LucideIcon;
  className: string;
} {
  const progressRaw = typeof args.progress === "number" ? args.progress : Number.parseInt(String(args.progress ?? "0"), 10);
  const progress = Number.isFinite(progressRaw) ? Math.max(0, Math.min(100, progressRaw)) : 0;
  const status = String(args.status ?? "").toLowerCase().trim();

  const derived: ComplianceState =
    status === "verified"
      ? "verified"
      : status === "in_progress" || status === "in-progress"
        ? "in_progress"
        : status === "unverified" || status === "not_compliant" || status === "not-compliant"
          ? "unverified"
          : progress >= 100
            ? "verified"
            : progress > 0
              ? "in_progress"
              : "unverified";

  if (derived === "verified") {
    return { state: "verified", progress: 100, label: "Compliant", icon: BadgeCheck, className: "text-emerald-600 dark:text-emerald-400" };
  }
  if (derived === "in_progress") {
    return { state: "in_progress", progress, label: `Compliance in progress (${progress}%)`, icon: BadgeAlert, className: "text-amber-600 dark:text-amber-400" };
  }
  return { state: "unverified", progress: 0, label: "Not compliant", icon: BadgeX, className: "text-destructive" };
}

