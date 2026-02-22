export type ServiceCallUrgency = "normal" | "urgent" | "emergency";

export const SERVICE_CALL_TYPES = [
  { value: "leak", label: "Leak / Burst pipe" },
  { value: "blocked-drain", label: "Blocked drain" },
  { value: "geyser", label: "Geyser / Water heater" },
  { value: "toilet", label: "Toilet / Trap" },
  { value: "low-pressure", label: "Low water pressure" },
  { value: "installation", label: "Installation / Upgrade" },
  { value: "inspection", label: "Inspection / Compliance" },
  { value: "other", label: "Other" },
] as const;

export type ServiceCallType = (typeof SERVICE_CALL_TYPES)[number]["value"];

export type ServiceCallTag =
  | "service-call"
  | ServiceCallType
  | "pirb-coc"
  | "gas-coc"
  | "pressure-test"
  | "after-hours"
  | "insurance";

const TAG_RE = /#([a-z0-9][a-z0-9-]*)/gi;

export function extractTags(text: string | null | undefined) {
  const out = new Set<string>();
  if (!text) return out;
  for (const m of text.matchAll(TAG_RE)) {
    const raw = m[1]?.toLowerCase();
    if (raw) out.add(raw);
  }
  return out;
}

export function hasTag(tags: Set<string>, tag: ServiceCallTag) {
  return tags.has(tag);
}

export function buildServiceCallTitle(args: { type: ServiceCallType; urgency: ServiceCallUrgency }) {
  const prefix = args.urgency === "emergency" ? "Emergency" : args.urgency === "urgent" ? "Urgent" : "Service call";
  const typeLabel = SERVICE_CALL_TYPES.find((t) => t.value === args.type)?.label ?? "Service call";
  return `${prefix}: ${typeLabel}`;
}

export function buildServiceCallNotes(args: {
  tags: ServiceCallTag[];
  callerName?: string;
  callerPhone?: string;
  address?: string;
  accessNotes?: string;
  reference?: string;
}) {
  const lines: string[] = [];
  const uniqueTags = Array.from(new Set(args.tags)).map((t) => `#${t}`);
  if (uniqueTags.length) lines.push(`Tags: ${uniqueTags.join(" ")}`);
  if (args.reference?.trim()) lines.push(`Ref: ${args.reference.trim()}`);
  if (args.callerName?.trim() || args.callerPhone?.trim()) {
    const who = [args.callerName?.trim(), args.callerPhone?.trim()].filter(Boolean).join(" · ");
    lines.push(`Caller: ${who}`);
  }
  if (args.address?.trim()) lines.push(`Address: ${args.address.trim()}`);
  if (args.accessNotes?.trim()) lines.push(`Access: ${args.accessNotes.trim()}`);
  return lines.filter(Boolean).join("\n");
}

export function getNoteLineValue(notes: string | null | undefined, label: string) {
  if (!notes) return "";
  const lines = notes.split("\n");
  const prefix = `${label.trim()}:`;
  const hit = lines.find((l) => l.trim().toLowerCase().startsWith(prefix.toLowerCase()));
  if (!hit) return "";
  return hit.slice(hit.indexOf(":") + 1).trim();
}

