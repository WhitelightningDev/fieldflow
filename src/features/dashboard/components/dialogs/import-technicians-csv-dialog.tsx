import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter as AlertDialogFooterInner,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TRADES, isTradeId, type TradeId } from "@/features/company-signup/content/trades";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { formatZar, getPlan, type PlanTier } from "@/features/subscription/plans";
import { parseCsv, normalizeCsvHeader } from "@/lib/csv";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { Upload } from "lucide-react";
import * as React from "react";

type TechnicianInsert = Omit<TablesInsert<"technicians">, "company_id" | "id" | "created_at">;

const HEADER_ALIASES: Record<string, keyof TechnicianInsert | "hourly_cost" | "hourly_bill_rate"> = {
  name: "name",
  technician: "name",
  technician_name: "name",

  email: "email",
  phone: "phone",

  active: "active",

  trades: "trades",
  trade: "trades",

  hourly_cost: "hourly_cost",
  hourly_cost_cents: "hourly_cost_cents",
  hourly_bill_rate: "hourly_bill_rate",
  hourly_bill_rate_cents: "hourly_bill_rate_cents",
};

function downloadTemplate() {
  const template =
    [
      "name,phone,email,trades,active,hourly_cost,hourly_bill_rate",
      'Jordan,+27 82 123 4567,tech@company.com,"plumbing|drain-cleaning",true,35.00,95.00',
    ].join("\n") + "\n";

  const blob = new Blob([template], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "technicians-template.csv";
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

function parseBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (["true", "1", "yes", "y", "active"].includes(v)) return true;
  if (["false", "0", "no", "n", "inactive"].includes(v)) return false;
  return null;
}

function moneyToCents(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function parseTrades(raw: string): TradeId[] {
  const v = raw.trim();
  if (!v) return [];
  const parts = v
    .split(/[|;,]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const out: TradeId[] = [];
  for (const p of parts) {
    if (isTradeId(p)) out.push(p);
  }
  return Array.from(new Set(out));
}

export default function ImportTechniciansCsvDialog() {
  const { actions, data } = useDashboardData();
  const [open, setOpen] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const [headers, setHeaders] = React.useState<string[]>([]);
  const [validRows, setValidRows] = React.useState<TechnicianInsert[]>([]);
  const [invalidRows, setInvalidRows] = React.useState<Array<{ row: number; reason: string }>>([]);

  const lockedTradeId: TradeId | null =
    data.company?.industry && isTradeId(data.company.industry) ? data.company.industry : null;

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

      const used = new Set<string>();
      const colToKey = normalized.map((h) => {
        const key = HEADER_ALIASES[h];
        if (!key) return null;
        const uniq = `${key}`;
        if (used.has(uniq)) return null;
        used.add(uniq);
        return key;
      });

      if (!colToKey.includes("name")) {
        setError('Missing required column "name". Download the template to get the correct headers.');
        return;
      }

      const nextValid: TechnicianInsert[] = [];
      const nextInvalid: Array<{ row: number; reason: string }> = [];

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const out: Partial<TechnicianInsert> & { hourly_cost?: string; hourly_bill_rate?: string } = {};
        for (let c = 0; c < colToKey.length; c++) {
          const key = colToKey[c];
          if (!key) continue;
          const raw = (r[c] ?? "").trim();
          if (!raw) continue;
          if (key === "active") {
            const b = parseBool(raw);
            if (b != null) out.active = b;
            continue;
          }
          if (key === "hourly_cost") {
            out.hourly_cost = raw;
            continue;
          }
          if (key === "hourly_bill_rate") {
            out.hourly_bill_rate = raw;
            continue;
          }
          if (key === "hourly_cost_cents" || key === "hourly_bill_rate_cents") {
            const n = Number.parseInt(raw, 10);
            (out as any)[key] = Number.isFinite(n) ? n : null;
            continue;
          }
          if (key === "trades") {
            (out as any).trades = raw;
            continue;
          }
          (out as any)[key] = raw;
        }

        const name = (out.name ?? "").toString().trim();
        if (!name) {
          nextInvalid.push({ row: i + 1, reason: "Missing technician name" });
          continue;
        }

        const parsedTrades = lockedTradeId ? [lockedTradeId] : parseTrades(str((out as any).trades));
        const fallbackTrades = lockedTradeId ? [lockedTradeId] : [TRADES[0].id];

        const normalizedRow: TechnicianInsert = {
          name,
          phone: emptyToNull(str(out.phone)),
          email: emptyToNull(str(out.email)),
          active: typeof out.active === "boolean" ? out.active : true,
          trades: (parsedTrades.length ? parsedTrades : fallbackTrades) as any,
          hourly_cost_cents:
            typeof out.hourly_cost_cents === "number"
              ? out.hourly_cost_cents
              : out.hourly_cost
                ? moneyToCents(out.hourly_cost)
                : null,
          hourly_bill_rate_cents:
            typeof out.hourly_bill_rate_cents === "number"
              ? out.hourly_bill_rate_cents
              : out.hourly_bill_rate
                ? moneyToCents(out.hourly_bill_rate)
                : null,
        };

        nextValid.push(normalizedRow);
      }

      setValidRows(nextValid);
      setInvalidRows(nextInvalid);
      if (nextValid.length === 0) setError("No valid technicians found to import.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to read CSV.");
    }
  }, [lockedTradeId, reset]);

  const preview = React.useMemo(() => validRows.slice(0, 5), [validRows]);

  const company = data.company as Tables<"companies"> | null;
  const subscriptionTier = company?.subscription_tier as PlanTier | undefined;
  const perTechPriceCents =
    typeof company?.per_tech_price_cents === "number" && Number.isFinite(company.per_tech_price_cents)
      ? company.per_tech_price_cents
      : subscriptionTier === "starter" || subscriptionTier === "pro" || subscriptionTier === "business"
        ? getPlan(subscriptionTier).perTechPriceCents
        : 0;

  const includedLimit =
    typeof company?.included_techs === "number" && Number.isFinite(company.included_techs)
      ? Math.max(0, Math.floor(company.included_techs))
      : 1;

  const activeNow = React.useMemo(() => {
    return (data.technicians ?? []).filter((t) => Boolean(t.active)).length;
  }, [data.technicians]);

  const activeToAdd = React.useMemo(() => {
    return (validRows ?? []).filter((t) => t.active === true).length;
  }, [validRows]);

  const billableBefore = Math.max(0, activeNow - includedLimit);
  const billableAfter = Math.max(0, activeNow + activeToAdd - includedLimit);
  const addedBillableSeats = Math.max(0, billableAfter - billableBefore);
  const wouldIncreaseBilling = addedBillableSeats > 0;

  const doImport = async () => {
    setBusy(true);
    try {
      await actions.addTechniciansBulk(validRows as any);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import technicians from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV with a header row. Required: <span className="font-medium">name</span>. (This creates technician records; login access is still set via “Set access”.)
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

          {lockedTradeId ? (
            <div className="rounded-lg border bg-card/70 backdrop-blur-sm p-3 text-xs text-muted-foreground">
              Trade is locked to <span className="font-medium text-foreground">{lockedTradeId}</span> for this company.
            </div>
          ) : null}

          {validRows.length ? (
            <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
              <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
                <div className="text-sm">
                  Ready to import <span className="font-medium">{validRows.length}</span> technician
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
                    <TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((t, idx) => (
                    <TableRow key={`${t.name}-${idx}`}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.phone || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.email || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.active ? "Yes" : "No"}</TableCell>
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
              if (wouldIncreaseBilling) {
                setConfirmOpen(true);
                return;
              }
              await doImport();
            }}
          >
            Import {validRows.length || ""}{validRows.length === 1 ? " technician" : validRows.length ? " technicians" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Import will add billable technicians</AlertDialogTitle>
          <AlertDialogDescription>
            This import will add {addedBillableSeats} billable seat{addedBillableSeats === 1 ? "" : "s"} to your subscription at {formatZar(perTechPriceCents)}/month each.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="text-sm text-muted-foreground space-y-1">
          <div>Active technicians now: {activeNow}</div>
          <div>Active technicians importing: {activeToAdd}</div>
          <div>Included active technicians: {includedLimit}</div>
        </div>
        <AlertDialogFooterInner>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={() => {
              setConfirmOpen(false);
              void doImport();
            }}
          >
            {busy ? "Importing..." : "Confirm & import"}
          </AlertDialogAction>
        </AlertDialogFooterInner>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
