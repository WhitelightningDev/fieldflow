import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, isPast } from "date-fns";
import { AlertTriangle, Plus, ShieldCheck, Trash2 } from "lucide-react";
import * as React from "react";

const CREDENTIAL_TYPES = [
  { value: "ecsa", label: "ECSA Registration" },
  { value: "ewseta", label: "EWSETA Qualification" },
  { value: "wireman_licence", label: "Wireman's Licence" },
  { value: "pirb", label: "PIRB Registration" },
  { value: "trade_test", label: "Trade Test Certificate" },
  { value: "other", label: "Other" },
] as const;

type Credential = {
  id: string;
  credential_type: string;
  registration_number: string;
  holder_name: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

function statusBadge(status: string, expiryDate: string | null) {
  if (expiryDate && isPast(new Date(expiryDate))) {
    return <Badge variant="destructive">Expired</Badge>;
  }
  if (expiryDate) {
    const days = differenceInDays(new Date(expiryDate), new Date());
    if (days <= 30) return <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">Expiring soon</Badge>;
  }
  if (status === "verified") return <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Verified</Badge>;
  if (status === "pending") return <Badge variant="secondary">Pending</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function TechnicianCredentialsDialog({
  technicianId,
  technicianName,
  companyId,
  open,
  onOpenChange,
}: {
  technicianId: string;
  technicianName: string;
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [credentials, setCredentials] = React.useState<Credential[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // New credential form
  const [credType, setCredType] = React.useState("ecsa");
  const [regNumber, setRegNumber] = React.useState("");
  const [holderName, setHolderName] = React.useState("");
  const [issuedDate, setIssuedDate] = React.useState("");
  const [expiryDate, setExpiryDate] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const fetchCredentials = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("technician_credentials" as any)
      .select("*")
      .eq("technician_id", technicianId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    setCredentials((data as any) ?? []);
    setLoading(false);
  }, [technicianId, companyId]);

  React.useEffect(() => {
    if (open) fetchCredentials();
  }, [open, fetchCredentials]);

  const resetForm = () => {
    setCredType("ecsa");
    setRegNumber("");
    setHolderName("");
    setIssuedDate("");
    setExpiryDate("");
    setNotes("");
    setAdding(false);
  };

  const handleAdd = async () => {
    if (!regNumber.trim()) {
      toast({ title: "Registration number required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("technician_credentials" as any).insert({
      technician_id: technicianId,
      company_id: companyId,
      credential_type: credType,
      registration_number: regNumber.trim(),
      holder_name: holderName.trim() || null,
      issued_date: issuedDate || null,
      expiry_date: expiryDate || null,
      notes: notes.trim() || null,
      status: "pending",
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Failed to add credential", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Credential added" });
    resetForm();
    fetchCredentials();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("technician_credentials" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Credential removed" });
    fetchCredentials();
  };

  const handleVerify = async (id: string) => {
    const { error } = await supabase
      .from("technician_credentials" as any)
      .update({ status: "verified", verified_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Failed to verify", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Credential marked as verified" });
    fetchCredentials();
  };

  const expiringCount = credentials.filter((c) => {
    if (!c.expiry_date) return false;
    const days = differenceInDays(new Date(c.expiry_date), new Date());
    return days <= 30 && days >= 0;
  }).length;

  const expiredCount = credentials.filter((c) => c.expiry_date && isPast(new Date(c.expiry_date))).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Credentials — {technicianName}
          </DialogTitle>
          <DialogDescription>
            Track ECSA, EWSETA, and other regulatory registrations. Expiry alerts appear 30 days before.
          </DialogDescription>
        </DialogHeader>

        {(expiringCount > 0 || expiredCount > 0) && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              {expiredCount > 0 && <span className="text-destructive font-medium">{expiredCount} expired</span>}
              {expiredCount > 0 && expiringCount > 0 && " · "}
              {expiringCount > 0 && <span className="text-amber-600 font-medium">{expiringCount} expiring soon</span>}
            </span>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : credentials.length === 0 && !adding ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No credentials on file.</div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Registration #</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {credentials.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">
                      {CREDENTIAL_TYPES.find((t) => t.value === c.credential_type)?.label ?? c.credential_type}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{c.registration_number}</TableCell>
                    <TableCell className="text-sm">
                      {c.expiry_date ? format(new Date(c.expiry_date), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell>{statusBadge(c.status, c.expiry_date)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {c.status !== "verified" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleVerify(c.id)}>
                            Verify
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => handleDelete(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {adding && (
          <div className="space-y-3 rounded-lg border p-4 bg-secondary/20">
            <div className="text-sm font-medium">Add credential</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={credType} onValueChange={setCredType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CREDENTIAL_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Registration number *</Label>
                <Input value={regNumber} onChange={(e) => setRegNumber(e.target.value)} placeholder="e.g. ECSA/12345" />
              </div>
              <div className="space-y-1.5">
                <Label>Holder name</Label>
                <Input value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="As on certificate" />
              </div>
              <div className="space-y-1.5">
                <Label>Issued date</Label>
                <Input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry date</Label>
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes…" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={saving} className="gradient-bg hover:opacity-90">
                {saving ? "Saving…" : "Add credential"}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {!adding && (
            <Button variant="outline" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add credential
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
