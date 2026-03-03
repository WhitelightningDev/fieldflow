import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { isTradeId, TRADES, type TradeId } from "@/features/company-signup/content/trades";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { formatZar, getPlan, type PlanTier } from "@/features/subscription/plans";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import { getFunctionsInvokeErrorMessage } from "@/lib/supabase-error";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { subscribeOnboardingDialog, type OnboardingDialogKey } from "@/features/onboarding/ui-events";

const tradeIds = TRADES.map((t) => t.id) as [TradeId, ...TradeId[]];

const schema = z.object({
  name: z.string().min(2, "Technician name is required"),
  phone: z.string().optional(),
  email: z.string().email("Email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  hourlyCost: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+(\.\d{1,2})?$/.test(v.trim()), "Enter amount like 35 or 35.50"),
  hourlyBillRate: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+(\.\d{1,2})?$/.test(v.trim()), "Enter amount like 95 or 95.50"),
  active: z.boolean().default(true),
  trades: z.array(z.enum(tradeIds)).min(1, "Select at least one trade"),
});

type Values = z.infer<typeof schema>;

function moneyToCents(v?: string) {
  const s = (v ?? "").trim();
  if (!s) return null;
  return Math.round(Number.parseFloat(s) * 100);
}

function generatePassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

type CreateTechnicianDialogProps = {
  trigger?: React.ReactElement;
  onboardingDialogKey?: OnboardingDialogKey;
  enableTourTags?: boolean;
};

export default function CreateTechnicianDialog(props: CreateTechnicianDialogProps = {}) {
  const { actions, data } = useDashboardData();
  const { profile } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [accessOpen, setAccessOpen] = React.useState(false);
  const [accessDetails, setAccessDetails] = React.useState<{ email: string; password: string; loginLink: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pendingValues, setPendingValues] = React.useState<Values | null>(null);
  const [creating, setCreating] = React.useState(false);

  const enableTourTags = props.enableTourTags ?? false;

  React.useEffect(() => {
    if (!props.onboardingDialogKey) return;
    return subscribeOnboardingDialog((detail) => {
      if (detail.key !== props.onboardingDialogKey) return;
      setOpen(detail.open);
    });
  }, [props.onboardingDialogKey]);

  const lockedTradeId: TradeId | null =
    data.company?.industry && isTradeId(data.company.industry) ? data.company.industry : null;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      password: "",
      hourlyCost: "",
      hourlyBillRate: "",
      active: true,
      trades: [lockedTradeId ?? TRADES[0].id],
    },
    mode: "onTouched",
  });

  React.useEffect(() => {
    if (!open) return;
    if (!lockedTradeId) return;
    form.setValue("trades", [lockedTradeId], { shouldValidate: true });
  }, [form, lockedTradeId, open]);

  const company = data.company as Tables<"companies"> | null;
  const subscriptionTier = company?.subscription_tier as PlanTier | undefined;
  const perTechPriceCents =
    typeof company?.per_tech_price_cents === "number" && Number.isFinite(company.per_tech_price_cents)
      ? company.per_tech_price_cents
      : subscriptionTier === "starter" || subscriptionTier === "pro" || subscriptionTier === "business"
        ? getPlan(subscriptionTier).perTechPriceCents
        : 0;

  const includedLimit =
    typeof company?.included_techs === "number" && Number.isFinite(company.included_techs)
      ? Math.max(0, Math.floor(company.included_techs))
      : 1;

  const activeCount = React.useMemo(() => {
    return (data.technicians ?? []).filter((t) => Boolean(t.active)).length;
  }, [data.technicians]);

  const doCreate = async (values: Values) => {
    if (!profile?.company_id) {
      toast({ title: "Not ready", description: "No company found on your profile. Please re-login.", variant: "destructive" });
      return;
    }

    try {
      setCreating(true);

      // 1) Provision technician login access first so we can store `technicians.user_id` at creation time
      let provisionedUserId: string | null = null;
      let provisionedLoginLink: string | null = null;
      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke("invite-technician", {
          body: {
            companyId: profile.company_id,
            industry: data.company?.industry,
            password: values.password,
            email: values.email,
            name: values.name,
            redirectTo: `${getPublicSiteUrl()}/auth/callback?next=/tech`,
          },
        });
        if (fnError) {
          let details = await getFunctionsInvokeErrorMessage(fnError, { functionName: "invite-technician" });
          if (details === "Not authorized. Please re-login and try again.") {
            details = "Not authorized to create technician access. Please re-login and try again.";
          }
          if (details.toLowerCase().includes("supabasekey is required")) {
            details =
              "Supabase Edge Function is missing required secrets (usually `SUPABASE_SERVICE_ROLE_KEY`). Set the secret and redeploy the function.";
          }
          toast({ title: "Technician access failed", description: details, variant: "destructive" });
          return;
        }

        provisionedUserId = ((fnData as any)?.userId as string | undefined) ?? null;
        provisionedLoginLink = ((fnData as any)?.loginLink as string | undefined) ?? null;
        if (!provisionedUserId) {
          toast({ title: "Technician access failed", description: "Missing `userId` from edge function response.", variant: "destructive" });
          return;
        }
      } catch {
        toast({ title: "Technician access failed", description: "Could not provision login access.", variant: "destructive" });
        return;
      }

      // 2) Create technician record with `user_id` set
      const tech = await actions.addTechnician({
        user_id: provisionedUserId,
        invite_status: "invited",
        name: values.name,
        phone: values.phone || null,
        email: values.email || null,
        hourly_cost_cents: moneyToCents(values.hourlyCost),
        hourly_bill_rate_cents: moneyToCents(values.hourlyBillRate),
        active: values.active,
        trades: lockedTradeId ? [lockedTradeId] : values.trades,
      });

      if (!tech) return;

      if (provisionedLoginLink) {
        setAccessDetails({ email: values.email, password: values.password, loginLink: provisionedLoginLink });
        setAccessOpen(true);
      }
      toast({ title: "Technician added", description: "Login access created. Copy the portal link and share it with the technician." });

      setOpen(false);
      form.reset({ name: "", phone: "", email: "", password: "", hourlyCost: "", hourlyBillRate: "", active: true, trades: [lockedTradeId ?? TRADES[0].id] });
    } finally {
      setCreating(false);
    }
  };

  const submit = form.handleSubmit(async (values) => {
    // Confirm billing impact before any provisioning happens.
    const wouldBeBillable = Boolean(values.active) && activeCount + 1 > includedLimit;
    if (wouldBeBillable) {
      setPendingValues(values);
      setConfirmOpen(true);
      return;
    }
    await doCreate(values);
  });

  const selectedTrades = form.watch("trades");

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {props.trigger ?? <Button size="sm" data-tour="technicians-add">Add technician</Button>}
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add technician</DialogTitle>
            <DialogDescription>
              Create the technician and set their initial password. You'll get a portal link to copy/share (no email verification).
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={submit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Jordan"
                      autoComplete="name"
                      data-tour={enableTourTags ? "technician-name" : undefined}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+27 ..." autoComplete="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (login)</FormLabel>
                    <FormControl>
                      <Input placeholder="tech@company.com" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-2">
                    <FormLabel>Initial password</FormLabel>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => form.setValue("password", generatePassword(), { shouldDirty: true, shouldValidate: true })}
                    >
                      Generate
                    </Button>
                  </div>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="Set a password (min 8 chars)"
                      autoComplete="new-password"
                      data-tour={enableTourTags ? "technician-password" : undefined}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="hourlyCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hourly cost (R, optional)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="e.g. 35.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hourlyBillRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hourly bill rate (R, optional)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="e.g. 95.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Trades</div>
              {lockedTradeId ? (
                <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                  {TRADES.find((t) => t.id === lockedTradeId)?.name ?? lockedTradeId}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {TRADES.map((t) => {
                      const checked = selectedTrades.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-left hover:bg-secondary/50 transition-colors"
                          onClick={() => {
                            const next = checked ? selectedTrades.filter((x) => x !== t.id) : [...selectedTrades, t.id];
                            form.setValue("trades", next, { shouldValidate: true, shouldDirty: true });
                          }}
                        >
                          <Checkbox checked={checked} />
                          <span className="text-sm">{t.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  <FormField control={form.control} name="trades" render={() => <FormMessage />} />
                </>
              )}
            </div>

            <DialogFooter>
              <Button
                type="submit"
                className="gradient-bg hover:opacity-90 shadow-glow"
                disabled={form.formState.isSubmitting || creating}
                data-tour={enableTourTags ? "technician-submit" : undefined}
              >
                {form.formState.isSubmitting || creating ? "Creating..." : "Create technician access"}
              </Button>
            </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          setConfirmOpen(next);
          if (!next) setPendingValues(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Additional technician will be billed</AlertDialogTitle>
            <AlertDialogDescription>
              This technician will add {formatZar(perTechPriceCents)}/month to your subscription because only {includedLimit} active technician{includedLimit === 1 ? "" : "s"} {includedLimit === 1 ? "is" : "are"} included.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Active technicians now: {activeCount}</div>
            <div>Active technicians after: {activeCount + 1}</div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={creating || !pendingValues}
              onClick={() => {
                const v = pendingValues;
                setConfirmOpen(false);
                setPendingValues(null);
                if (!v) return;
                void doCreate(v);
              }}
            >
              {creating ? "Creating..." : "Confirm & create"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Technician portal access</DialogTitle>
            <DialogDescription>Copy and share this link with the technician. The link is one-time.</DialogDescription>
          </DialogHeader>

          {accessDetails ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Portal link</Label>
                <div className="flex gap-2">
                  <Input readOnly value={accessDetails.loginLink} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(accessDetails.loginLink);
                      toast({ title: "Copied portal link" });
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Initial password</Label>
                <div className="flex gap-2">
                  <Input readOnly value={accessDetails.password} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(accessDetails.password);
                      toast({ title: "Copied password" });
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="pt-2">
            <Button variant="secondary" onClick={() => setAccessOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
