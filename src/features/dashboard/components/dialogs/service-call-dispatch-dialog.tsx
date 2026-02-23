import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { fromDatetimeLocal, toDatetimeLocal } from "@/features/dashboard/lib/datetime";
import {
  buildServiceCallNotes,
  buildServiceCallTitle,
  extractTags,
  getNoteLineValue,
  SERVICE_CALL_TYPES,
  type ServiceCallTag,
  type ServiceCallType,
  type ServiceCallUrgency,
} from "@/features/dashboard/lib/service-calls";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import type { Tables } from "@/integrations/supabase/types";
import { Pencil } from "lucide-react";
import * as React from "react";

type JobCard = Tables<"job_cards">;

const NONE = "__none__";

const urgencyOptions: { value: ServiceCallUrgency; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
  { value: "emergency", label: "Emergency" },
];

export default function ServiceCallDispatchDialog({ job, trigger }: { job: JobCard; trigger?: React.ReactNode }) {
  const { data, actions } = useDashboardData();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const tags = React.useMemo(() => extractTags(job.notes), [job.notes]);

  const [callType, setCallType] = React.useState<ServiceCallType>("other");
  const [urgency, setUrgency] = React.useState<ServiceCallUrgency>(() => (job.priority as any) || "normal");
  const [scheduledAt, setScheduledAt] = React.useState(() => toDatetimeLocal(job.scheduled_at ?? undefined));
  const [customerId, setCustomerId] = React.useState(job.customer_id ?? NONE);
  const [siteId, setSiteId] = React.useState(job.site_id ?? NONE);
  const [technicianId, setTechnicianId] = React.useState(job.technician_id ?? NONE);
  const [description, setDescription] = React.useState(job.description ?? "");
  const [callerName, setCallerName] = React.useState("");
  const [callerPhone, setCallerPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [accessNotes, setAccessNotes] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [csat, setCsat] = React.useState<string>("");
  const [requiresPirbCoc, setRequiresPirbCoc] = React.useState(false);
  const [requiresGasCoc, setRequiresGasCoc] = React.useState(false);
  const [requiresPressureTest, setRequiresPressureTest] = React.useState(false);
  const [afterHours, setAfterHours] = React.useState(false);
  const [insuranceClaim, setInsuranceClaim] = React.useState(false);
  const [notesRest, setNotesRest] = React.useState("");

  const customers = data.customers;
  const sites = data.sites;
  const technicians = data.technicians;

  const sitesForCustomer = React.useMemo(() => {
    if (!customerId || customerId === NONE) return sites;
    const filtered = sites.filter((s: any) => String(s.customer_id ?? "") === customerId);
    return filtered.length ? filtered : sites;
  }, [customerId, sites]);

  React.useEffect(() => {
    if (!open) return;
    const t = extractTags(job.notes);
    const inferredType =
      (SERVICE_CALL_TYPES.map((x) => x.value) as string[]).find((v) => t.has(v)) ??
      "other";
    setCallType(inferredType as ServiceCallType);
    setUrgency(((job.priority as any) || "normal") as ServiceCallUrgency);
    setScheduledAt(toDatetimeLocal(job.scheduled_at ?? undefined));
    setCustomerId(job.customer_id ?? NONE);
    setSiteId(job.site_id ?? NONE);
    setTechnicianId(job.technician_id ?? NONE);
    setDescription(job.description ?? "");

    const caller = getNoteLineValue(job.notes, "Caller");
    if (caller.includes("·")) {
      const [n, p] = caller.split("·").map((s) => s.trim());
      setCallerName(n || "");
      setCallerPhone(p || "");
    } else {
      setCallerName(caller);
      setCallerPhone("");
    }
    setAddress(getNoteLineValue(job.notes, "Address"));
    setAccessNotes(getNoteLineValue(job.notes, "Access"));
    setReference(getNoteLineValue(job.notes, "Ref"));
    const csatRaw = getNoteLineValue(job.notes, "CSAT");
    const csatMatch = csatRaw.match(/(\d+(?:\.\d+)?)/);
    setCsat(csatMatch ? String(csatMatch[1]) : "");

    setRequiresPirbCoc(t.has("pirb-coc"));
    setRequiresGasCoc(t.has("gas-coc"));
    setRequiresPressureTest(t.has("pressure-test"));
    setAfterHours(t.has("after-hours"));
    setInsuranceClaim(t.has("insurance"));

    const rest = (job.notes ?? "")
      .split("\n")
      .filter((l) => !/^tags:/i.test(l.trim()))
      .filter((l) => !/^ref:/i.test(l.trim()))
      .filter((l) => !/^caller:/i.test(l.trim()))
      .filter((l) => !/^address:/i.test(l.trim()))
      .filter((l) => !/^access:/i.test(l.trim()))
      .filter((l) => !/^csat:/i.test(l.trim()))
      .join("\n")
      .trim();
    setNotesRest(rest);
  }, [job, open]);

  const save = async () => {
    setSaving(true);
    const nextTags: ServiceCallTag[] = ["service-call", callType];
    if (requiresPirbCoc) nextTags.push("pirb-coc");
    if (requiresGasCoc) nextTags.push("gas-coc");
    if (requiresPressureTest) nextTags.push("pressure-test");
    if (afterHours) nextTags.push("after-hours");
    if (insuranceClaim) nextTags.push("insurance");

    const csatLine = (() => {
      const v = csat.trim();
      if (!v) return "";
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0.5 || n > 5) return "";
      const out = Math.round(n * 10) / 10;
      return `CSAT: ${out}/5`;
    })();

    const notes = [
      buildServiceCallNotes({
        tags: nextTags,
        callerName,
        callerPhone,
        address,
        accessNotes,
        reference,
      }),
      csatLine,
      notesRest?.trim() ? notesRest.trim() : "",
    ]
      .filter(Boolean)
      .join("\n")
      .trim();

    const patch: any = {
      customer_id: customerId && customerId !== NONE ? customerId : null,
      site_id: siteId && siteId !== NONE ? siteId : null,
      technician_id: technicianId && technicianId !== NONE ? technicianId : null,
      priority: urgency,
      scheduled_at: scheduledAt ? fromDatetimeLocal(scheduledAt) ?? null : null,
      title: /^(Service call|Urgent|Emergency):/i.test(job.title)
        ? buildServiceCallTitle({ type: callType, urgency })
        : undefined,
      description: description || null,
      notes: notes || null,
    };

    if (patch.title === undefined) delete patch.title;
    const updated = await actions.updateJobCard(job.id, patch);
    setSaving(false);
    if (!updated) return;
    toast({ title: "Service call updated" });
    setOpen(false);
  };

  const tagBadges = Array.from(tags).filter((t) => t !== "service-call").slice(0, 6);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Dispatch
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dispatch details</DialogTitle>
          <DialogDescription>
            Update scheduling, assignment, and compliance flags. {tagBadges.length ? `Tags: ${tagBadges.map((t) => `#${t}`).join(" ")}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Call type</Label>
            <Select value={callType} onValueChange={(v) => setCallType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_CALL_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Urgency</Label>
            <Select value={urgency} onValueChange={(v) => setUrgency(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {urgencyOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mt-4">
          <div className="space-y-2">
            <Label>Dispatch time</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Technician</Label>
            <Select value={technicianId} onValueChange={setTechnicianId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mt-4">
          <div className="space-y-2">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={(v) => setCustomerId(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} disabled>
                  Select customer…
                </SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Site</Label>
            <Select value={siteId} onValueChange={(v) => setSiteId(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No site</SelectItem>
                {sitesForCustomer.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label>Problem description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description for the technician…" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mt-4">
          <div className="space-y-2">
            <Label>Caller name</Label>
            <Input value={callerName} onChange={(e) => setCallerName(e.target.value)} placeholder="Tenant / landlord / manager" />
          </div>
          <div className="space-y-2">
            <Label>Caller phone</Label>
            <Input value={callerPhone} onChange={(e) => setCallerPhone(e.target.value)} placeholder="082 123 4567" />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, suburb, city" />
          </div>
          <div className="space-y-2">
            <Label>Access</Label>
            <Input value={accessNotes} onChange={(e) => setAccessNotes(e.target.value)} placeholder="Gate code, keys, parking…" />
          </div>
          <div className="space-y-2">
            <Label>Reference</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO / insurance claim / job ref" />
          </div>
        </div>

        <div className="rounded-lg border bg-card/70 p-3 space-y-3 mt-4">
          <div className="text-sm font-medium">Compliance & flags</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Checkbox checked={requiresPirbCoc} onCheckedChange={(v) => setRequiresPirbCoc(Boolean(v))} />
              <Label className="m-0">PIRB plumbing CoC required</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={requiresPressureTest} onCheckedChange={(v) => setRequiresPressureTest(Boolean(v))} />
              <Label className="m-0">Pressure test required</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={requiresGasCoc} onCheckedChange={(v) => setRequiresGasCoc(Boolean(v))} />
              <Label className="m-0">Gas compliance CoC (LPG) required</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={afterHours} onCheckedChange={(v) => setAfterHours(Boolean(v))} />
              <Label className="m-0">After-hours call-out</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={insuranceClaim} onCheckedChange={(v) => setInsuranceClaim(Boolean(v))} />
              <Label className="m-0">Insurance claim</Label>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Stored as #tags in job notes.
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label>Additional notes</Label>
          <Textarea value={notesRest} onChange={(e) => setNotesRest(e.target.value)} placeholder="Extra info for office/technician…" rows={4} />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Customer satisfaction (CSAT)</Label>
            <Select value={csat || NONE} onValueChange={(v) => setCsat(v === NONE ? "" : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not captured</SelectItem>
                <SelectItem value="1">1 / 5</SelectItem>
                <SelectItem value="2">2 / 5</SelectItem>
                <SelectItem value="3">3 / 5</SelectItem>
                <SelectItem value="4">4 / 5</SelectItem>
                <SelectItem value="5">5 / 5</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-[11px] text-muted-foreground">
              Saved into notes as a <span className="font-medium text-foreground">CSAT</span> line for dashboard reporting.
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} className="gradient-bg hover:opacity-90 shadow-glow" disabled={saving}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
