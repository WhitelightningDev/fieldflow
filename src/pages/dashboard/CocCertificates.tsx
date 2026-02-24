import PageHeader from "@/features/dashboard/components/page-header";
import CocCertificatesManager from "@/features/coc/components/coc-certificates-manager";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { useSearchParams } from "react-router-dom";
import * as React from "react";

export default function CocCertificates() {
  const { data } = useDashboardData();
  const companyId = data.company?.id ?? null;
  const [searchParams, setSearchParams] = useSearchParams();
  const initialJobId = searchParams.get("jobId");

  // Best-effort: clear the param so reloads don't keep auto-opening the dialog.
  React.useEffect(() => {
    if (!initialJobId) return;
    const next = new URLSearchParams(searchParams);
    next.delete("jobId");
    setSearchParams(next, { replace: true });
  }, [initialJobId, searchParams, setSearchParams]);

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="COC Certificates" subtitle="Manage Certificates of Compliance for electrical work." />
        <div className="text-sm text-muted-foreground">Create a company profile first.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="COC Certificates" subtitle="South Africa (Electrical Installation Regulations, 2009 Annexure 1) + Test Report template." />
      <CocCertificatesManager companyId={companyId} sites={data.sites} jobs={data.jobCards} initialJobId={initialJobId} />
    </div>
  );
}
