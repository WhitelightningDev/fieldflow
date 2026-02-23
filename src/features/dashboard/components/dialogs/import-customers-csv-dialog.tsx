import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { parseCsv, normalizeCsvHeader } from "@/lib/csv";
import type { TablesInsert } from "@/integrations/supabase/types";
import { Upload } from "lucide-react";
import * as React from "react";

type CustomerInsert = Omit<TablesInsert<"customers">, "company_id" | "id" | "created_at">;

const HEADER_ALIASES: Record<string, keyof CustomerInsert> = {
  name: "name",
  customer: "name",
  customer_name: "name",

  email: "email",
  primary_email: "email",

  phone: "phone",
  mobile: "phone",

  address: "address",
  billing_address: "address",

  code: "code",
  customer_code: "code",

  billing_email: "billing_email",
  accounts_email: "billing_email",

  billing_phone: "billing_phone",
  accounts_phone: "billing_phone",

  billing_reference: "billing_reference",
  reference: "billing_reference",
  po: "billing_reference",
  po_number: "billing_reference",

  vat: "vat_number",
  vat_number: "vat_number",

  payment_terms: "payment_terms",
  terms: "payment_terms",

  notes: "notes",
};

function downloadTemplate() {
  const template =
    [
      "name,phone,email,address,code,billing_phone,billing_email,billing_reference,vat_number,payment_terms,notes",
      'Acme Properties,+27 82 123 4567,billing@acme.com,"12 Long St, Cape Town",ACME-001,+27 82 555 0000,accounts@acme.com,PO-1234,4123456789,30,"Gate code: 1234"',
    ].join("\n") + "\n";

  const blob = new Blob([template], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "customers-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function emptyToNull(value: string): string | null {
  const v = value.trim();
  return v ? v : null;
}

function str(value: unknown) {
  return typeof value === "string" ? value : "";
}

export default function ImportCustomersCsvDialog() {
  const { actions } = useDashboardData();
  const [open, setOpen] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [headers, setHeaders] = React.useState<string[]>([]);
  const [validRows, setValidRows] = React.useState<CustomerInsert[]>([]);
  const [invalidRows, setInvalidRows] = React.useState<Array<{ row: number; reason: string }>>([]);

  const reset = React.useCallback(() => {
    setFileName(null);
    setError(null);
    setHeaders([]);
    setValidRows([]);
    setInvalidRows([]);
  }, []);

  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onFile = React.useCallback(async (file: File | null) => {
    reset();
    if (!file) return;
    setFileName(file.name);

    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      const rows = parsed.rows.filter((r) => r.some((c) => c.trim() !== ""));
      if (rows.length < 2) {
        setError("That CSV has no data rows.");
        return;
      }

      const rawHeaders = rows[0].map((h) => h.trim());
      setHeaders(rawHeaders);
      const normalized = rawHeaders.map((h) => normalizeCsvHeader(h));

      const usedKeys = new Set<keyof CustomerInsert>();
      const colToKey = normalized.map((h) => {
        const key = HEADER_ALIASES[h];
        if (!key) return null;
        if (usedKeys.has(key)) return null;
        usedKeys.add(key);
        return key;
      });

      if (!colToKey.includes("name")) {
        setError('Missing required column "name". Download the template to get the correct headers.');
        return;
      }

      const nextValid: CustomerInsert[] = [];
      const nextInvalid: Array<{ row: number; reason: string }> = [];

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const out: Partial<CustomerInsert> = {};
        for (let c = 0; c < colToKey.length; c++) {
          const key = colToKey[c];
          if (!key) continue;
          const raw = (r[c] ?? "").trim();
          if (!raw) continue;
          if (key === "payment_terms") {
            const n = Number.parseInt(raw, 10);
            out.payment_terms = Number.isFinite(n) ? n : null;
            continue;
          }
          (out as any)[key] = raw;
        }

        const name = (out.name ?? "").toString().trim();
        if (!name) {
          nextInvalid.push({ row: i + 1, reason: "Missing customer name" });
          continue;
        }

        const normalizedRow: CustomerInsert = {
          name,
          address: emptyToNull(str(out.address)),
          billing_email: emptyToNull(str(out.billing_email)),
          billing_phone: emptyToNull(str(out.billing_phone)),
          billing_reference: emptyToNull(str(out.billing_reference)),
          code: emptyToNull(str(out.code)),
          email: emptyToNull(str(out.email)),
          notes: emptyToNull(str(out.notes)),
          payment_terms: out.payment_terms ?? null,
          phone: emptyToNull(str(out.phone)),
          vat_number: emptyToNull(str(out.vat_number)),
        };

        nextValid.push(normalizedRow);
      }

      setValidRows(nextValid);
      setInvalidRows(nextInvalid);
      if (nextValid.length === 0) {
        setError("No valid customers found to import.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to read CSV.");
    }
  }, [reset]);

  const preview = React.useMemo(() => validRows.slice(0, 5), [validRows]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import customers from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV with a header row. Required: <span className="font-medium">name</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {fileName ? (
                <>
                  File: <span className="font-medium text-foreground">{fileName}</span>
                </>
              ) : (
                "Choose a CSV file to preview and import."
              )}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
              Download template
            </Button>
          </div>

          <input
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />

          {error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {headers.length ? (
            <div className="rounded-lg border bg-card/70 backdrop-blur-sm p-3 space-y-2">
              <div className="text-sm font-medium">Detected columns</div>
              <div className="text-xs text-muted-foreground break-words">{headers.join(", ")}</div>
            </div>
          ) : null}

          {validRows.length ? (
            <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
              <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
                <div className="text-sm">
                  Ready to import <span className="font-medium">{validRows.length}</span> customer
                  {validRows.length === 1 ? "" : "s"}.
                  {invalidRows.length ? (
                    <span className="text-muted-foreground"> {invalidRows.length} row{invalidRows.length === 1 ? "" : "s"} skipped.</span>
                  ) : null}
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((c, idx) => (
                    <TableRow key={`${c.name}-${idx}`}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.phone || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.email || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.address || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {validRows.length > preview.length ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-xs text-muted-foreground">
                        Showing first {preview.length} rows.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {invalidRows.length ? (
            <div className="rounded-lg border bg-card/70 backdrop-blur-sm p-3">
              <div className="text-sm font-medium">Skipped rows</div>
              <ul className="mt-1 text-xs text-muted-foreground space-y-1">
                {invalidRows.slice(0, 5).map((r) => (
                  <li key={`${r.row}-${r.reason}`}>Row {r.row}: {r.reason}</li>
                ))}
                {invalidRows.length > 5 ? <li>…and {invalidRows.length - 5} more</li> : null}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={reset} disabled={busy}>
            Reset
          </Button>
          <Button
            type="button"
            className="gradient-bg hover:opacity-90 shadow-glow"
            disabled={busy || validRows.length === 0}
            onClick={async () => {
              setBusy(true);
              try {
                await actions.addCustomersBulk(validRows as any);
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            Import {validRows.length || ""}{validRows.length === 1 ? " customer" : validRows.length ? " customers" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
