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

export default function DeleteCustomerAlertDialog({
  customerId,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  customerId: string | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { data, actions } = useDashboardData();
  const customer = customerId ? (data.customers.find((c) => c.id === customerId) as any) : null;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = typeof openProp === "boolean" ? openProp : uncontrolledOpen;
  const setOpen =
    typeof openProp === "boolean" ? (onOpenChange ?? (() => {})) : onOpenChange ?? setUncontrolledOpen;

  if (!customer) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      ) : openProp == null ? (
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="ghost" aria-label="Delete customer">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
      ) : null}
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
              if (!customerId) return;
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
