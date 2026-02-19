const DEFAULT_MAX = 150;

export function ensureShortString(field: string, value: unknown, max: number = DEFAULT_MAX): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required`);
  }
  if (trimmed.length > max) {
    throw new Error(`${field} is too long (${trimmed.length}/${max})`);
  }
  return trimmed;
}

export function logVarcharLengths(context: string, fields: Record<string, unknown>) {
  const lengths: Record<string, number | "non-string"> = {};
  for (const [k, v] of Object.entries(fields)) {
    lengths[k] = typeof v === "string" ? v.trim().length : "non-string";
  }
  // eslint-disable-next-line no-console
  console.debug(`[${context}] varchar lengths`, lengths);
}

