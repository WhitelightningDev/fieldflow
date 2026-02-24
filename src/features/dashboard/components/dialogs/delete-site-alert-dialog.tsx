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

export default function DeleteSiteAlertDialog({
  siteId,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  siteId: string | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { data, actions } = useDashboardData();
  const site = siteId ? (data.sites.find((s) => s.id === siteId) as any) : null;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = typeof openProp === "boolean" ? openProp : uncontrolledOpen;
  const setOpen =
    typeof openProp === "boolean" ? (onOpenChange ?? (() => {})) : onOpenChange ?? setUncontrolledOpen;

  if (!site) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      ) : openProp == null ? (
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="ghost" aria-label="Delete site">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
      ) : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete site?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes <span className="font-medium">{site.name}</span>. Job cards will remain but become unlinked from this site.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={async () => {
              if (!siteId) return;
              await actions.deleteSite(siteId);
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
