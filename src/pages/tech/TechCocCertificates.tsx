import CocCertificatesManager from "@/features/coc/components/coc-certificates-manager";
import { useTechData } from "@/features/technician/hooks/use-tech-data";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import * as React from "react";

export default function TechCocCertificates() {
  const { companyId, loading } = useTechData();
  const [sites, setSites] = React.useState<Array<Tables<"sites">>>([]);
  const [sitesLoading, setSitesLoading] = React.useState(false);

  React.useEffect(() => {
    if (!companyId) return;
    setSitesLoading(true);
    supabase
      .from("sites")
      .select("*")
      .eq("company_id", companyId)
      .order("name", { ascending: true })
      .then(({ data }) => { setSites(data ?? []); setSitesLoading(false); });
  }, [companyId]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }
  if (!companyId) {
    return <div className="text-sm text-muted-foreground">No company assigned.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">COC Certificates</h1>
          <div className="text-sm text-muted-foreground mt-1">Create and print South African electrical CoCs + Test Reports.</div>
        </div>
        {sitesLoading ? <div className="text-xs text-muted-foreground">Loading sites…</div> : null}
      </div>

      <CocCertificatesManager companyId={companyId} sites={sites} />
    </div>
  );
}
