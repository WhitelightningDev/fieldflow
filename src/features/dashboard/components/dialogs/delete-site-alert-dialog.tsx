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

export default function DeleteSiteAlertDialog({ siteId, trigger }: { siteId: string; trigger?: React.ReactNode }) {
  const { data, actions } = useDashboardData();
  const site = data.sites.find((s) => s.id === siteId) as any;
  const [open, setOpen] = React.useState(false);

  if (!site) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="ghost" aria-label="Delete site">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </AlertDialogTrigger>
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
