import CreateTeamDialog from "@/features/dashboard/components/dialogs/create-team-dialog";
import ManageTeamMembersDialog from "@/features/dashboard/components/dialogs/manage-team-members-dialog";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { Card, CardContent } from "@/components/ui/card";
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

      <div className="rounded-xl border bg-card/70 backdrop-blur-sm overflow-hidden">
        {/* Mobile: cards */}
        <div className="sm:hidden p-3 space-y-3">
          {data.teams.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No teams yet.</div>
          ) : null}

          {data.teams.map((team) => {
            const membersCount = data.teamMembers.filter((m) => m.team_id === team.id).length;
            return (
              <Card key={team.id} className="bg-background/50">
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{team.name}</div>
                      <div className="text-xs text-muted-foreground">{membersCount} member{membersCount === 1 ? "" : "s"}</div>
                    </div>
                    <ManageTeamMembersDialog teamId={team.id} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block">
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
    </div>
  );
}
