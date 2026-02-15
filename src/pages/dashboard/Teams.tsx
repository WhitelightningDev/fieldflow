import CreateTeamDialog from "@/features/dashboard/components/dialogs/create-team-dialog";
import ManageTeamMembersDialog from "@/features/dashboard/components/dialogs/manage-team-members-dialog";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Teams() {
  const { data } = useDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teams"
        subtitle="Create teams, add technicians, and assign teams to sites."
        actions={<CreateTeamDialog />}
      />

      <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Members</TableHead>
              <TableHead className="w-[180px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.teams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                  No teams yet.
                </TableCell>
              </TableRow>
            ) : null}

            {data.teams.map((team) => {
              const membersCount = data.teamMembers.filter((m) => m.team_id === team.id).length;
              return (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{membersCount}</TableCell>
                  <TableCell className="text-right">
                    <ManageTeamMembersDialog teamId={team.id} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

