import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { formatZarFromCents } from "@/lib/money";
import { format, startOfMonth, endOfMonth, subMonths, getMonth, getYear } from "date-fns";
import { Download, FileSpreadsheet, Receipt } from "lucide-react";
import * as React from "react";

type Period = { label: string; start: Date; end: Date };

function buildPeriods(): Period[] {
  const periods: Period[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    periods.push({
      label: format(d, "MMMM yyyy"),
      start: startOfMonth(d),
      end: endOfMonth(d),
    });
  }
  return periods;
}

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TaxReports() {
  const { data } = useDashboardData();
  const invoices = (data.invoices ?? []) as any[];
  const periods = React.useMemo(buildPeriods, []);
  const [selectedPeriod, setSelectedPeriod] = React.useState(0);
  const period = periods[selectedPeriod];

  const periodInvoices = React.useMemo(() => {
    return invoices.filter((inv) => {
      const d = new Date(inv.created_at);
      return d >= period.start && d <= period.end;
    });
  }, [invoices, period]);

  // VAT201 summary
  const totalRevenue = periodInvoices.reduce((s, i) => s + (i.subtotal_cents ?? 0), 0);
  const totalVat = periodInvoices.reduce((s, i) => s + (i.vat_cents ?? 0), 0);
  const totalInclVat = periodInvoices.reduce((s, i) => s + (i.total_cents ?? 0), 0);
  const totalPaid = periodInvoices.reduce((s, i) => s + (i.amount_paid_cents ?? 0), 0);
  const totalOutstanding = totalInclVat - totalPaid;
  const invoiceCount = periodInvoices.length;
  const paidCount = periodInvoices.filter((i) => i.status === "paid").length;

  // Income statement
  const totalLabour = periodInvoices.reduce((s, i) => s + (i.labour_total_cents ?? 0), 0);
  const totalParts = periodInvoices.reduce((s, i) => s + (i.parts_total_cents ?? 0), 0);
  const grossProfit = totalRevenue; // simplified — parts cost is revenue here

  const exportVat201 = () => {
    const headers = ["Invoice #", "Date", "Customer", "Excl. VAT (R)", "VAT (R)", "Incl. VAT (R)", "Status"];
    const rows = periodInvoices.map((inv) => [
      inv.invoice_number,
      format(new Date(inv.created_at), "yyyy-MM-dd"),
      inv.customer_id ?? "—",
      (inv.subtotal_cents / 100).toFixed(2),
      (inv.vat_cents / 100).toFixed(2),
      (inv.total_cents / 100).toFixed(2),
      inv.status,
    ]);
    rows.push(["TOTAL", "", "", (totalRevenue / 100).toFixed(2), (totalVat / 100).toFixed(2), (totalInclVat / 100).toFixed(2), ""]);
    downloadCsv(`VAT201-${format(period.start, "yyyy-MM")}.csv`, toCsv(headers, rows));
  };

  const exportIncome = () => {
    const headers = ["Category", "Amount (R)"];
    const rows = [
      ["Revenue (excl. VAT)", (totalRevenue / 100).toFixed(2)],
      ["Labour income", (totalLabour / 100).toFixed(2)],
      ["Parts / materials income", (totalParts / 100).toFixed(2)],
      ["Output VAT", (totalVat / 100).toFixed(2)],
      ["Total invoiced (incl. VAT)", (totalInclVat / 100).toFixed(2)],
      ["Received payments", (totalPaid / 100).toFixed(2)],
      ["Outstanding", (totalOutstanding / 100).toFixed(2)],
    ];
    downloadCsv(`Income-Statement-${format(period.start, "yyyy-MM")}.csv`, toCsv(headers, rows));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax Reports"
        subtitle="VAT201 summaries, income statements, and CSV exports for SARS eFiling and provisional tax."
      />

      <div className="flex items-center gap-3">
        <Select value={String(selectedPeriod)} onValueChange={(v) => setSelectedPeriod(Number(v))}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p, i) => (
              <SelectItem key={i} value={String(i)}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* VAT201 Summary */}
      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            VAT201 Summary — {period.label}
          </CardTitle>
          <CardDescription>Output tax summary for VAT return submission.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Invoices</div>
              <div className="text-lg font-semibold">{invoiceCount}</div>
              <div className="text-xs text-muted-foreground">{paidCount} paid</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Revenue (excl. VAT)</div>
              <div className="text-lg font-semibold">{formatZarFromCents(totalRevenue)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Output VAT</div>
              <div className="text-lg font-semibold">{formatZarFromCents(totalVat)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total (incl. VAT)</div>
              <div className="text-lg font-semibold">{formatZarFromCents(totalInclVat)}</div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={exportVat201}>
              <Download className="h-4 w-4 mr-1" /> Export VAT201 CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Income Statement */}
      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Income Statement — {period.label}
          </CardTitle>
          <CardDescription>Revenue breakdown for provisional tax calculations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Labour income</TableCell>
                  <TableCell className="text-right">{formatZarFromCents(totalLabour)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Parts / materials income</TableCell>
                  <TableCell className="text-right">{formatZarFromCents(totalParts)}</TableCell>
                </TableRow>
                <TableRow className="border-t-2">
                  <TableCell className="font-semibold">Revenue (excl. VAT)</TableCell>
                  <TableCell className="text-right font-semibold">{formatZarFromCents(totalRevenue)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Output VAT (15%)</TableCell>
                  <TableCell className="text-right">{formatZarFromCents(totalVat)}</TableCell>
                </TableRow>
                <TableRow className="border-t-2">
                  <TableCell className="font-semibold">Total invoiced</TableCell>
                  <TableCell className="text-right font-semibold">{formatZarFromCents(totalInclVat)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Payments received</TableCell>
                  <TableCell className="text-right text-primary">{formatZarFromCents(totalPaid)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Outstanding</TableCell>
                  <TableCell className="text-right text-destructive">{formatZarFromCents(totalOutstanding)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={exportIncome}>
              <Download className="h-4 w-4 mr-1" /> Export income CSV
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
