import { extractTags, getNoteLineValue } from "@/features/dashboard/lib/service-calls";

export type MaintenanceRepeat = "weekly" | "monthly" | "quarterly" | "biannual" | "annual";

export function getMaintenanceScheduleId(notes: string | null | undefined) {
  const raw = getNoteLineValue(notes, "MSID");
  const v = raw.trim();
  return v ? v : null;
}

export function getMaintenanceRepeat(notes: string | null | undefined): MaintenanceRepeat | null {
  const raw = getNoteLineValue(notes, "Repeat").toLowerCase().trim();
  if (raw === "weekly" || raw === "monthly" || raw === "quarterly" || raw === "biannual" || raw === "annual") return raw;
  return null;
}

export function getMaintenanceInterval(notes: string | null | undefined) {
  const raw = getNoteLineValue(notes, "Interval").trim();
  if (!raw) return 1;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.round(n));
}

export function isMaintenanceJob(notes: string | null | undefined) {
  const tags = extractTags(notes);
  return tags.has("maintenance");
}

export function formatRepeat(repeat: MaintenanceRepeat, interval: number) {
  const n = Math.max(1, Math.round(interval));
  const unit =
    repeat === "weekly"
      ? n === 1 ? "week" : "weeks"
      : repeat === "monthly"
        ? n === 1 ? "month" : "months"
        : repeat === "quarterly"
          ? n === 1 ? "quarter" : "quarters"
          : repeat === "biannual"
            ? n === 1 ? "half-year" : "half-years"
            : n === 1 ? "year" : "years";
  return `Every ${n} ${unit}`;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

export function computeNextDue(args: { from: Date; repeat: MaintenanceRepeat; interval: number }) {
  const n = Math.max(1, Math.round(args.interval));
  const base = args.from;
  if (args.repeat === "weekly") return new Date(base.getTime() + n * 7 * 86_400_000);
  if (args.repeat === "monthly") return addMonths(base, n);
  if (args.repeat === "quarterly") return addMonths(base, 3 * n);
  if (args.repeat === "biannual") return addMonths(base, 6 * n);
  return addMonths(base, 12 * n);
}

export function buildMaintenanceNotes(args: {
  msid: string;
  repeat: MaintenanceRepeat;
  interval: number;
  tags?: string[];
  reference?: string;
  accessNotes?: string;
  internalNotes?: string;
}) {
  const tags = Array.from(new Set([...(args.tags ?? []), "maintenance"])).map((t) => `#${t}`);
  const lines: string[] = [];
  lines.push(`Tags: ${tags.join(" ")}`);
  lines.push(`MSID: ${args.msid}`);
  lines.push(`Repeat: ${args.repeat}`);
  lines.push(`Interval: ${Math.max(1, Math.round(args.interval))}`);
  if (args.reference?.trim()) lines.push(`Ref: ${args.reference.trim()}`);
  if (args.accessNotes?.trim()) lines.push(`Access: ${args.accessNotes.trim()}`);
  if (args.internalNotes?.trim()) lines.push(args.internalNotes.trim());
  return lines.filter(Boolean).join("\n");
}

