import PageHeader from "@/features/dashboard/components/page-header";
import CocCertificatesManager from "@/features/coc/components/coc-certificates-manager";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";

export default function CocCertificates() {
  const { data } = useDashboardData();
  const companyId = data.company?.id ?? null;

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
      <CocCertificatesManager companyId={companyId} sites={data.sites} />
    </div>
  );
}
