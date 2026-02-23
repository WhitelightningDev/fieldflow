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

export default function DeleteCustomersAlertDialog({
  customerIds,
  onDeleted,
}: {
  customerIds: string[];
  onDeleted?: () => void;
}) {
  const { actions, data } = useDashboardData();
  const [open, setOpen] = React.useState(false);

  const ids = React.useMemo(() => Array.from(new Set(customerIds)).filter(Boolean), [customerIds]);
  const count = ids.length;
  const sampleNames = React.useMemo(() => {
    const byId = new Map(data.customers.map((c) => [c.id, c.name]));
    return ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .slice(0, 3) as string[];
  }, [data.customers, ids]);

  if (count === 0) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete selected ({count})
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {count} customer{count === 1 ? "" : "s"}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the selected customer{count === 1 ? "" : "s"}. Existing sites and job cards will remain (they may show as unlinked).
            {sampleNames.length ? (
              <span className="block mt-2 text-xs text-muted-foreground">
                {sampleNames.join(", ")}
                {count > sampleNames.length ? "…" : ""}
              </span>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={async () => {
              await actions.deleteCustomersBulk(ids);
              setOpen(false);
              onDeleted?.();
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

