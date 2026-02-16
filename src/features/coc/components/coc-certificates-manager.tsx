import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import * as React from "react";
import CreateCocCertificateDialog from "@/features/coc/components/create-coc-certificate-dialog";
import CocCertificateEditorDialog from "@/features/coc/components/coc-certificate-editor-dialog";
import { format } from "date-fns";

type CocRowLite = Pick<Tables<"coc_certificates">, "id" | "certificate_no" | "certificate_type" | "issued_at" | "created_at" | "updated_at" | "site_id">;

export default function CocCertificatesManager({
  companyId,
  sites,
}: {
  companyId: string;
  sites: Array<Tables<"sites">> | null | undefined;
}) {
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<CocRowLite[]>([]);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Tables<"coc_certificates"> | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);

  const sitesById = React.useMemo(() => new Map((sites ?? []).map((s) => [s.id, s])), [sites]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("coc_certificates")
        .select("id, certificate_no, certificate_type, issued_at, created_at, updated_at, site_id")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) {
        toast({ title: "Could not load CoCs", description: error.message, variant: "destructive" });
        return;
      }
      setRows((data ?? []) as unknown as CocRowLite[]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  React.useEffect(() => {
    refresh().catch(console.error);
  }, [refresh]);

  const openEditor = React.useCallback(async (id: string) => {
    const { data, error } = await supabase.from("coc_certificates").select("*").eq("id", id).single();
    if (error || !data) {
      toast({ title: "Could not open CoC", description: error?.message ?? "Unknown error", variant: "destructive" });
      return;
    }
    setSelected(data as any);
    setEditorOpen(true);
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.certificate_no ?? "").toLowerCase().includes(q));
  }, [query, rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by certificate number…"
            className="w-full sm:w-[320px]"
          />
          <Button variant="outline" onClick={() => refresh()} disabled={loading}>
            Refresh
          </Button>
        </div>
        <CreateCocCertificateDialog
          companyId={companyId}
          sites={sites}
          onCreated={(row) => {
            setRows((prev) => [{
              id: row.id,
              certificate_no: row.certificate_no,
              certificate_type: row.certificate_type,
              issued_at: row.issued_at,
              created_at: row.created_at,
              updated_at: row.updated_at,
              site_id: row.site_id,
            }, ...prev]);
            setSelected(row);
            setEditorOpen(true);
          }}
        />
      </div>

      <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Certificate No.</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[140px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No CoC certificates yet.
                </TableCell>
              </TableRow>
            ) : null}

            {filtered.map((r) => {
              const site = r.site_id ? sitesById.get(r.site_id) : null;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.certificate_no}</TableCell>
                  <TableCell className="capitalize">{r.certificate_type}</TableCell>
                  <TableCell>{site?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.issued_at ? format(new Date(r.issued_at), "PP") : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.updated_at ? format(new Date(r.updated_at), "PP") : "—"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => openEditor(r.id)}>
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selected ? (
        <CocCertificateEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          coc={selected}
          sites={sites}
          onSaved={(row) => {
            setSelected(row);
            setRows((prev) => prev.map((p) => (p.id === row.id ? ({
              ...p,
              certificate_no: row.certificate_no,
              certificate_type: row.certificate_type,
              issued_at: row.issued_at,
              updated_at: row.updated_at,
              site_id: row.site_id,
            }) : p)));
          }}
          onDeleted={(id) => setRows((prev) => prev.filter((p) => p.id !== id))}
        />
      ) : null}
    </div>
  );
}
