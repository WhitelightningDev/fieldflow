import CocCertificatesManager from "@/features/coc/components/coc-certificates-manager";
import { useTechData } from "@/features/technician/hooks/use-tech-data";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import * as React from "react";
import { useSearchParams } from "react-router-dom";

export default function TechCocCertificates() {
  const { companyId, loading } = useTechData();
  const [sites, setSites] = React.useState<Array<Tables<"sites">>>([]);
  const [sitesLoading, setSitesLoading] = React.useState(false);
  const [jobs, setJobs] = React.useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = React.useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

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

  React.useEffect(() => {
    if (!companyId) return;
    setJobsLoading(true);
    supabase
      .from("job_cards")
      .select("id, title, description, notes, status, site_id, updated_at, customers(name), sites(name, address)")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false })
      .limit(300)
      .then(({ data }) => {
        setJobs(data ?? []);
        setJobsLoading(false);
      });
  }, [companyId]);

  const initialJobId = searchParams.get("jobId");
  React.useEffect(() => {
    if (!initialJobId) return;
    // Clear the param so reloads don't keep auto-opening the dialog.
    const next = new URLSearchParams(searchParams);
    next.delete("jobId");
    setSearchParams(next, { replace: true });
  }, [initialJobId, searchParams, setSearchParams]);

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
        {sitesLoading || jobsLoading ? <div className="text-xs text-muted-foreground">Loading…</div> : null}
      </div>

      <CocCertificatesManager companyId={companyId} sites={sites} jobs={jobs} initialJobId={initialJobId} />
    </div>
  );
}
