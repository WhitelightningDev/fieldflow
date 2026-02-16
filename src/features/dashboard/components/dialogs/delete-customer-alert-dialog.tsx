import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { Trash2 } from "lucide-react";
import * as React from "react";

export default function DeleteCustomerAlertDialog({ customerId }: { customerId: string }) {
  const { data, actions } = useDashboardData();
  const customer = data.customers.find((c) => c.id === customerId) as any;
  const [open, setOpen] = React.useState(false);

  if (!customer) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label="Delete customer">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete customer?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes <span className="font-medium">{customer.name}</span>. Existing sites and job cards will remain (they may show as unlinked).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={async () => {
              await actions.deleteCustomer(customerId);
              setOpen(false);
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

