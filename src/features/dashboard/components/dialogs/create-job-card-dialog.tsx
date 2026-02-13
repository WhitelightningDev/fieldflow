import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { TRADES, type TradeId } from "@/features/company-signup/content/trades";
import { TRADE_JOB_CHECKLISTS } from "@/features/dashboard/constants/job-checklists";
import { fromDatetimeLocal } from "@/features/dashboard/lib/datetime";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import type { JobCardStatus } from "@/features/dashboard/types/job-card";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const STATUSES: JobCardStatus[] = ["new", "scheduled", "in-progress", "completed", "invoiced", "cancelled"];
const tradeIds = TRADES.map((t) => t.id) as [TradeId, ...TradeId[]];

const schema = z.object({
  tradeId: z.enum(tradeIds),
  title: z.string().min(2, "Job title is required"),
  description: z.string().optional(),
  status: z.enum(STATUSES as [JobCardStatus, ...JobCardStatus[]]),
  customerId: z.string().min(1, "Select a customer"),
  technicianId: z.string().optional(),
  scheduledAt: z.string().optional(),
  checklist: z.string().optional(),
  notes: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export default function CreateJobCardDialog({ defaultTradeId }: { defaultTradeId: TradeId }) {
  const { data, actions } = useDashboardData();
  const [open, setOpen] = React.useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      tradeId: defaultTradeId,
      title: "",
      description: "",
      status: "new",
      customerId: data.customers[0]?.id ?? "",
      technicianId: "",
      scheduledAt: "",
      checklist: TRADE_JOB_CHECKLISTS[defaultTradeId].join("\n"),
      notes: "",
    },
    mode: "onTouched",
  });

  React.useEffect(() => {
    if (!open) return;
    form.setValue("tradeId", defaultTradeId);
    form.setValue("checklist", TRADE_JOB_CHECKLISTS[defaultTradeId].join("\n"));
  }, [defaultTradeId, form, open]);

  const tradeId = form.watch("tradeId") as TradeId;

  React.useEffect(() => {
    if (!open) return;
    const checklist = TRADE_JOB_CHECKLISTS[tradeId]?.join("\n") ?? "";
    form.setValue("checklist", checklist, { shouldDirty: true });
  }, [form, open, tradeId]);

  const submit = form.handleSubmit((values) => {
    actions.addJobCard({
      tradeId: values.tradeId,
      title: values.title,
      description: values.description || undefined,
      status: values.status,
      customerId: values.customerId,
      technicianId: values.technicianId || undefined,
      scheduledAt: values.scheduledAt ? fromDatetimeLocal(values.scheduledAt) : undefined,
      checklist: (values.checklist || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      notes: values.notes || undefined,
    });
    toast({ title: "Job card created" });
    setOpen(false);
    form.reset({ ...form.getValues(), title: "", description: "", notes: "" });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gradient-bg hover:opacity-90 shadow-glow">
          Create job card
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create job card</DialogTitle>
          <DialogDescription>Job cards are unified across trades, with trade-specific checklists.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tradeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trade</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select trade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TRADES.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Emergency call-out" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Short description of the work..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {data.customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="technicianId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Technician (optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {data.technicians.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="scheduledAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scheduled (optional)</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="checklist"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Checklist</FormLabel>
                  <FormControl>
                    <Textarea rows={6} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Anything important for the tech..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" className="gradient-bg hover:opacity-90 shadow-glow" disabled={form.formState.isSubmitting}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
