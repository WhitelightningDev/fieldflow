import AssignTeamToSiteDialog from "@/features/dashboard/components/dialogs/assign-team-to-site-dialog";
import CreateSiteDialog from "@/features/dashboard/components/dialogs/create-site-dialog";
import DeleteSiteAlertDialog from "@/features/dashboard/components/dialogs/delete-site-alert-dialog";
import EditSiteDialog from "@/features/dashboard/components/dialogs/edit-site-dialog";
import ManageSiteDialog from "@/features/dashboard/components/dialogs/manage-site-dialog";
import ProfitabilityPill from "@/features/dashboard/components/profitability-pill";
import { computeSiteProfitability } from "@/features/dashboard/lib/profitability";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { Button } from "@/components/ui/button";
import RowActionsMenu from "@/components/row-actions-menu";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Tables } from "@/integrations/supabase/types";
import { formatDistanceToNowStrict } from "date-fns";
import * as React from "react";

type SiteTeamAssignment = Tables<"site_team_assignments">;

function getCurrentAssignment(assignments: SiteTeamAssignment[]) {
  const now = Date.now();
  const active = assignments
    .filter((a) => {
      const start = new Date((a as any).starts_at ?? (a as any).assigned_at ?? a.created_at).getTime();
      const end = (a as any).ends_at ? new Date((a as any).ends_at).getTime() : Infinity;
      return start <= now && end >= now;
    })
    .sort((a, b) => new Date((b as any).starts_at ?? (b as any).assigned_at ?? b.created_at).getTime() - new Date((a as any).starts_at ?? (a as any).assigned_at ?? a.created_at).getTime());
  return active[0];
}

export default function Sites() {
  const { data, actions } = useDashboardData();
  const [manageSiteId, setManageSiteId] = React.useState<string | null>(null);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [editSiteId, setEditSiteId] = React.useState<string | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [assignSiteId, setAssignSiteId] = React.useState<string | null>(null);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [deleteSiteId, setDeleteSiteId] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const customersById = new Map(data.customers.map((c) => [c.id, c]));
  const teamsById = new Map(data.teams.map((t) => [t.id, t]));

  const techniciansById = React.useMemo(() => new Map(data.technicians.map((t) => [t.id, t])), [data.technicians]);
  const inventoryById = React.useMemo(() => new Map(data.inventoryItems.map((i) => [i.id, i])), [data.inventoryItems]);
  const jobsBySiteId = React.useMemo(() => {
    const m = new Map<string, any[]>();
    for (const j of data.jobCards) {
      const siteId = (j as any).site_id;
      if (!siteId) continue;
      const arr = m.get(siteId) ?? [];
      arr.push(j);
      m.set(siteId, arr);
    }
    return m;
  }, [data.jobCards]);
  const timeByJobId = React.useMemo(() => {
    const m = new Map<string, any[]>();
    for (const e of data.jobTimeEntries) {
      const jobId = e.job_card_id;
      if (!jobId) continue;
      const arr = m.get(jobId) ?? [];
      arr.push(e);
      m.set(jobId, arr);
    }
    return m;
  }, [data.jobTimeEntries]);
  const materialsBySiteId = React.useMemo(() => {
    const m = new Map<string, any[]>();
    for (const u of data.siteMaterialUsage) {
      const siteId = u.site_id;
      if (!siteId) continue;
      const arr = m.get(siteId) ?? [];
      arr.push(u);
      m.set(siteId, arr);
    }
    return m;
  }, [data.siteMaterialUsage]);

  return (
    <div className="space-y-6">
      <ManageSiteDialog
        siteId={manageSiteId}
        open={manageOpen}
        onOpenChange={(open) => {
          setManageOpen(open);
          if (!open) setManageSiteId(null);
        }}
      />
      <EditSiteDialog
        siteId={editSiteId}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditSiteId(null);
        }}
      />
      <AssignTeamToSiteDialog
        siteId={assignSiteId}
        open={assignOpen}
        onOpenChange={(open) => {
          setAssignOpen(open);
          if (!open) setAssignSiteId(null);
        }}
      />
      <DeleteSiteAlertDialog
        siteId={deleteSiteId}
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteSiteId(null);
        }}
      />
      <PageHeader
        title="Sites"
        subtitle="Site-level control: team assignments, time tracking, photos, materials, and COC documentation."
        actions={<CreateSiteDialog onboardingDialogKey="create-site" />}
      />

      <div className="rounded-xl border bg-card/70 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Site</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Current team</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Profitability</TableHead>
              <TableHead className="w-[260px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.sites.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  No sites yet.
                </TableCell>
              </TableRow>
            ) : null}

            {data.sites.map((site) => {
              const customer = (site as any).customer_id ? customersById.get((site as any).customer_id) : undefined;
              const assignments = data.siteTeamAssignments.filter((a) => a.site_id === site.id);
              const current = getCurrentAssignment(assignments);
              const currentTeam = current ? teamsById.get(current.team_id) : undefined;
              const currentEndsAt = current?.ends_at ?? null;

              const jobs = jobsBySiteId.get(site.id) ?? [];
              const timeEntries = jobs.flatMap((j: any) => timeByJobId.get(j.id) ?? []);
              const materials = materialsBySiteId.get(site.id) ?? [];
              const profitability = computeSiteProfitability({
                jobs,
                timeEntries,
                materials,
                techniciansById,
                inventoryById,
              });
              return (
                <TableRow key={site.id}>
                  <TableCell>
                    <div className="font-medium">{site.name}</div>
                    {(site as any).scope_of_work ? (
                      <div className="text-xs text-muted-foreground line-clamp-1">{(site as any).scope_of_work}</div>
                    ) : null}
                    <div className="text-xs text-muted-foreground">
                      Updated {formatDistanceToNowStrict(new Date(site.updated_at), { addSuffix: true })}
                    </div>
                  </TableCell>
                  <TableCell>{customer?.name ?? "—"}</TableCell>
                  <TableCell>
                    {currentTeam ? (
                      <div className="space-y-0.5">
                        <div className="font-medium">{currentTeam.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {currentEndsAt ? `Ends ${formatDistanceToNowStrict(new Date(currentEndsAt), { addSuffix: true })}` : "Active"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{site.address ?? "—"}</TableCell>
                  <TableCell>
                    <ProfitabilityPill value={profitability} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <RowActionsMenu label="Site actions">
                        <DropdownMenuItem
                          onSelect={() => {
                            setManageSiteId(site.id);
                            setManageOpen(true);
                          }}
                        >
                          Manage
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditSiteId(site.id);
                            setEditOpen(true);
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setAssignSiteId(site.id);
                            setAssignOpen(true);
                          }}
                        >
                          Assign team
                        </DropdownMenuItem>
                        {current ? (
                          <DropdownMenuItem onSelect={() => void actions.endSiteAssignment(current.id, new Date().toISOString())}>
                            End now
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => {
                            setDeleteSiteId(site.id);
                            setDeleteOpen(true);
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </RowActionsMenu>
                    </div>
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
