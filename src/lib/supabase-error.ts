function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object") return null;
  return v as Record<string, unknown>;
}

function pickFirstString(obj: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

async function readResponseBodyMessage(res: Response): Promise<string | null> {
  try {
    const raw = await (typeof res.clone === "function" ? res.clone().text() : res.text());
    const text = raw?.trim();
    if (!text) return null;

    // Try JSON first (even if content-type is wrong)
    try {
      const parsed = JSON.parse(text);
      const rec = asRecord(parsed);
      if (rec) {
        const msg =
          pickFirstString(rec, ["error", "message", "details", "hint"]) ??
          // Some functions return nested objects
          (() => {
            const inner = asRecord(rec.error) ?? asRecord(rec.message);
            if (!inner) return null;
            return pickFirstString(inner, ["message", "details", "hint"]);
          })();
        if (msg) return msg;
      }
    } catch {
      // ignore
    }

    return text;
  } catch {
    return null;
  }
}

export async function getFunctionsInvokeErrorMessage(
  error: unknown,
  opts?: { functionName?: string },
): Promise<string> {
  const rec = asRecord(error);
  const ctx = rec ? asRecord(rec.context) : null;
  const res = (ctx?.response as Response | undefined) ?? undefined;

  if (res) {
    const status = typeof res.status === "number" ? res.status : undefined;

    // Friendly defaults for the most common deployment/auth mistakes.
    if (status === 404 && opts?.functionName) return `Edge function "${opts.functionName}" is not deployed.`;
    if (status === 401) return "Not authorized. Please re-login and try again.";

    const bodyMsg = await readResponseBodyMessage(res);
    if (bodyMsg) return status ? `(${status}) ${bodyMsg}` : bodyMsg;
  }

  const directMsg =
    (rec ? pickFirstString(rec, ["error_description", "msg", "message"]) : null) ??
    (rec ? pickFirstString(rec, ["details", "hint"]) : null);
  if (directMsg) return directMsg;

  try {
    return String(error);
  } catch {
    return "Unknown error";
  }
}

export function getPostgrestErrorMessage(error: unknown): string {
  const rec = asRecord(error);
  if (!rec) return "Unknown error";
  const message = pickFirstString(rec, ["message"]) ?? "Request failed";
  const details = pickFirstString(rec, ["details"]);
  const hint = pickFirstString(rec, ["hint"]);

  const extra = [details, hint].filter(Boolean).join(" • ");
  return extra ? `${message} — ${extra}` : message;
}

