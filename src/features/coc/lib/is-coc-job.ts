export function isCocComplianceJob(job: { title?: unknown; description?: unknown; notes?: unknown }): boolean {
  const hay = `${job?.title ?? ""} ${job?.description ?? ""} ${job?.notes ?? ""}`.toLowerCase();
  return (
    hay.includes("coc") ||
    hay.includes("certificate of compliance") ||
    hay.includes("compliance inspection") ||
    hay.includes("compliance")
  );
}

