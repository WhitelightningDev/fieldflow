import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/features/dashboard/components/page-header";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { FileWarning, Plus, Shield, Trash2, UserX } from "lucide-react";
import * as React from "react";

type ConsentRecord = {
  id: string;
  entity_type: string;
  entity_id: string;
  consent_type: string;
  consent_given: boolean;
  consented_at: string;
  withdrawn_at: string | null;
  notes: string | null;
};

type DeletionRequest = {
  id: string;
  requester_name: string;
  requester_email: string;
  entity_type: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
  denial_reason: string | null;
  notes: string | null;
};

export default function PopiaManagement() {
  const { data } = useDashboardData();
  const companyId = (data.company as any)?.id as string | undefined;

  const [consents, setConsents] = React.useState<ConsentRecord[]>([]);
  const [deletionRequests, setDeletionRequests] = React.useState<DeletionRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addDeletionOpen, setAddDeletionOpen] = React.useState(false);

  // Deletion request form
  const [drName, setDrName] = React.useState("");
  const [drEmail, setDrEmail] = React.useState("");
  const [drType, setDrType] = React.useState("customer");
  const [drNotes, setDrNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [{ data: c }, { data: d }] = await Promise.all([
      supabase.from("popia_consent_records" as any).select("*").eq("company_id", companyId).order("consented_at", { ascending: false }).limit(100),
      supabase.from("popia_deletion_requests" as any).select("*").eq("company_id", companyId).order("requested_at", { ascending: false }).limit(100),
    ]);
    setConsents((c as any) ?? []);
    setDeletionRequests((d as any) ?? []);
    setLoading(false);
  }, [companyId]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const handleWithdrawConsent = async (id: string) => {
    const { error } = await supabase
      .from("popia_consent_records" as any)
      .update({ consent_given: false, withdrawn_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Consent withdrawn" });
    fetchData();
  };

  const handleCompleteDeletion = async (id: string) => {
    const { error } = await supabase
      .from("popia_deletion_requests" as any)
      .update({ status: "completed", completed_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Deletion request completed" });
    fetchData();
  };

  const handleCreateDeletion = async () => {
    if (!drName.trim() || !drEmail.trim()) {
      toast({ title: "Name and email required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("popia_deletion_requests" as any).insert({
      company_id: companyId,
      requester_name: drName.trim(),
      requester_email: drEmail.trim(),
      entity_type: drType,
      status: "pending",
      notes: drNotes.trim() || null,
    } as any);
    setSaving(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Deletion request created" });
    setAddDeletionOpen(false);
    setDrName(""); setDrEmail(""); setDrType("customer"); setDrNotes("");
    fetchData();
  };

  const pendingDeletions = deletionRequests.filter((d) => d.status === "pending").length;

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="POPIA Compliance"
        subtitle="Manage data subject consent, retention policies, and right-to-deletion requests."
      />

      {/* Overview KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Consent records</div>
            <div className="text-2xl font-bold">{consents.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Pending deletions</div>
            <div className="text-2xl font-bold text-destructive">{pendingDeletions}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total deletion requests</div>
            <div className="text-2xl font-bold">{deletionRequests.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Deletion Requests */}
      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-primary" />
                Right to Deletion Requests
              </CardTitle>
              <CardDescription>Track and process data subject deletion requests within 30 days per POPIA.</CardDescription>
            </div>
            <Button variant="outline" onClick={() => setAddDeletionOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Log request
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {deletionRequests.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No deletion requests.</div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requester</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletionRequests.map((dr) => (
                    <TableRow key={dr.id}>
                      <TableCell className="font-medium">{dr.requester_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{dr.requester_email}</TableCell>
                      <TableCell><Badge variant="secondary">{dr.entity_type}</Badge></TableCell>
                      <TableCell className="text-sm">{format(new Date(dr.requested_at), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        {dr.status === "pending" && <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400">Pending</Badge>}
                        {dr.status === "completed" && <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">Completed</Badge>}
                        {dr.status === "denied" && <Badge variant="destructive">Denied</Badge>}
                      </TableCell>
                      <TableCell>
                        {dr.status === "pending" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleCompleteDeletion(dr.id)}>
                            Complete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Consent Records */}
      <Card className="bg-card/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Consent Audit Trail
          </CardTitle>
          <CardDescription>Records of data processing consent given or withdrawn.</CardDescription>
        </CardHeader>
        <CardContent>
          {consents.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <FileWarning className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No consent records yet. Consents are automatically logged when quote requests include profile consent.
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity type</TableHead>
                    <TableHead>Consent type</TableHead>
                    <TableHead>Given</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Withdrawn</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consents.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell><Badge variant="secondary">{c.entity_type}</Badge></TableCell>
                      <TableCell className="text-sm">{c.consent_type}</TableCell>
                      <TableCell>{c.consent_given ? <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">Yes</Badge> : <Badge variant="destructive">No</Badge>}</TableCell>
                      <TableCell className="text-sm">{format(new Date(c.consented_at), "dd MMM yyyy")}</TableCell>
                      <TableCell className="text-sm">{c.withdrawn_at ? format(new Date(c.withdrawn_at), "dd MMM yyyy") : "—"}</TableCell>
                      <TableCell>
                        {c.consent_given && !c.withdrawn_at && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleWithdrawConsent(c.id)}>
                            Withdraw
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Deletion Request Dialog */}
      <Dialog open={addDeletionOpen} onOpenChange={setAddDeletionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log deletion request</DialogTitle>
            <DialogDescription>Record a data subject's request to delete their personal information. POPIA requires completion within 30 days.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Requester name *</Label>
                <Input value={drName} onChange={(e) => setDrName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={drEmail} onChange={(e) => setDrEmail(e.target.value)} placeholder="email@example.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Data type</Label>
              <Select value={drType} onValueChange={setDrType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer data</SelectItem>
                  <SelectItem value="quote_requester">Quote requester data</SelectItem>
                  <SelectItem value="technician">Technician data</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={drNotes} onChange={(e) => setDrNotes(e.target.value)} rows={2} placeholder="Details of what data should be deleted…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDeletionOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateDeletion} disabled={saving} className="gradient-bg hover:opacity-90">
              {saving ? "Saving…" : "Log request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
