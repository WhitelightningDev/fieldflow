import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { Trash2 } from "lucide-react";
import * as React from "react";

export default function ManageTeamMembersDialog({ teamId }: { teamId: string }) {
  const { data, actions } = useDashboardData();
  const [open, setOpen] = React.useState(false);
  const [technicianId, setTechnicianId] = React.useState("");

  const team = data.teams.find((t) => t.id === teamId);
  const members = data.teamMembers.filter((m) => m.team_id === teamId);
  const memberTechIds = new Set(members.map((m) => (m as any).technician_id));
  const availableTechs = data.technicians.filter((t) => !memberTechIds.has(t.id));

  React.useEffect(() => {
    if (!open) setTechnicianId("");
  }, [open]);

  const add = async () => {
    if (!technicianId) return;
    const created = await actions.addTeamMember(teamId, technicianId);
    if (!created) return;
    const name = data.technicians.find((t) => t.id === technicianId)?.name ?? "Technician";
    toast({ title: "Member added", description: name });
    setTechnicianId("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Manage members
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Team members</DialogTitle>
          <DialogDescription>{team ? `Manage members for "${team.name}".` : "Manage members for this team."}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Select value={technicianId} onValueChange={setTechnicianId}>
            <SelectTrigger className="sm:w-[360px]">
              <SelectValue placeholder={availableTechs.length ? "Add technician..." : "No technicians available"} />
            </SelectTrigger>
            <SelectContent>
              {availableTechs.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={add} disabled={!technicianId}>
            Add
          </Button>
        </div>

        <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Technician</TableHead>
                <TableHead className="w-[120px] text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground py-10">
                    No members yet.
                  </TableCell>
                </TableRow>
              ) : null}
              {members.map((m) => {
                const tech = data.technicians.find((t) => t.id === (m as any).technician_id);
                return (
                  <TableRow key={m.id}>
                    <TableCell>{tech?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => actions.removeTeamMember(m.id)} aria-label="Remove member">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

