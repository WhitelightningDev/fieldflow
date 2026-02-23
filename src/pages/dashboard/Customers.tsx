import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import CreateCustomerDialog from "@/features/dashboard/components/dialogs/create-customer-dialog";
import DeleteCustomerAlertDialog from "@/features/dashboard/components/dialogs/delete-customer-alert-dialog";
import DeleteCustomersAlertDialog from "@/features/dashboard/components/dialogs/delete-customers-alert-dialog";
import EditCustomerDialog from "@/features/dashboard/components/dialogs/edit-customer-dialog";
import ImportCustomersCsvDialog from "@/features/dashboard/components/dialogs/import-customers-csv-dialog";
import ManageCustomerDialog from "@/features/dashboard/components/dialogs/manage-customer-dialog";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import * as React from "react";
import RowActionsMenu from "@/components/row-actions-menu";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export default function Customers() {
  const { data } = useDashboardData();
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const allIds = React.useMemo(() => data.customers.map((c) => c.id), [data.customers]);
  const allIdSet = React.useMemo(() => new Set(allIds), [allIds]);
  const selectedCount = selectedIds.size;
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = selectedCount > 0 && !allSelected;

  React.useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (allIdSet.has(id)) next.add(id);
      return next;
    });
  }, [allIdSet]);

  const toggleAll = React.useCallback((checked: boolean) => {
    setSelectedIds(checked ? new Set(allIds) : new Set());
  }, [allIds]);

  const toggleOne = React.useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle="Keep customer details and job history organized."
        actions={
          <>
            <ImportCustomersCsvDialog />
            {selectedCount ? (
              <DeleteCustomersAlertDialog
                customerIds={Array.from(selectedIds)}
                onDeleted={() => setSelectedIds(new Set())}
              />
            ) : null}
            <CreateCustomerDialog />
          </>
        }
      />

      <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => toggleAll(Boolean(v))}
                  aria-label="Select all customers"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  No customers yet.
                </TableCell>
              </TableRow>
            ) : null}
            {data.customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(c.id)}
                    onCheckedChange={(v) => toggleOne(c.id, Boolean(v))}
                    aria-label={`Select ${c.name}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.phone || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.email || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.address || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <RowActionsMenu label="Customer actions">
                      <ManageCustomerDialog customerId={c.id} trigger={<DropdownMenuItem>Manage</DropdownMenuItem>} />
                      <EditCustomerDialog customerId={c.id} trigger={<DropdownMenuItem>Edit</DropdownMenuItem>} />
                      <DropdownMenuSeparator />
                      <DeleteCustomerAlertDialog
                        customerId={c.id}
                        trigger={<DropdownMenuItem className="text-destructive focus:text-destructive">Delete</DropdownMenuItem>}
                      />
                    </RowActionsMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
