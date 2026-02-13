import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CreateCustomerDialog from "@/features/dashboard/components/dialogs/create-customer-dialog";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";

export default function Customers() {
  const { data } = useDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" subtitle="Keep customer details and job history organized." actions={<CreateCustomerDialog />} />

      <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
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
            {data.customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                  No customers yet.
                </TableCell>
              </TableRow>
            ) : null}
            {data.customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.phone || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.email || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.address || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

