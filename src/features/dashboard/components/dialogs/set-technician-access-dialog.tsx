import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useDashboardData } from "@/features/dashboard/store/dashboard-data-store";
import { supabase } from "@/integrations/supabase/client";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import { getFunctionsInvokeErrorMessage } from "@/lib/supabase-error";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type Values = z.infer<typeof schema>;

function generatePassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export default function SetTechnicianAccessDialog({
  technicianId,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  technicianId: string | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { data } = useDashboardData();
  const { profile } = useAuth();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = typeof openProp === "boolean" ? openProp : uncontrolledOpen;
  const setOpen =
    typeof openProp === "boolean" ? (onOpenChange ?? (() => {})) : onOpenChange ?? setUncontrolledOpen;
  const [loginLink, setLoginLink] = React.useState<string>("");

  const technician = technicianId ? (data.technicians.find((t) => t.id === technicianId) as any) : null;
  const email = (technician?.email as string | null | undefined) ?? "";
  const name = (technician?.name as string | null | undefined) ?? "Technician";

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "" },
    mode: "onTouched",
  });

  React.useEffect(() => {
    if (!open) return;
    setLoginLink("");
    form.reset({ password: "" });
  }, [form, open]);

  const submit = form.handleSubmit(async (values) => {
    if (!profile?.company_id) {
      toast({ title: "Not ready", description: "No company found on your profile. Please re-login.", variant: "destructive" });
      return;
    }
    if (!technicianId) return;
    if (!email) {
      toast({ title: "Missing email", description: "Add an email address to this technician before creating access.", variant: "destructive" });
      return;
    }

    const { data: fnData, error: fnError } = await supabase.functions.invoke("invite-technician", {
      body: {
        technicianId,
        companyId: profile.company_id,
        industry: data.company?.industry,
        password: values.password,
        redirectTo: `${getPublicSiteUrl()}/auth/callback?next=/tech`,
      },
    });

    if (fnError) {
      const details = await getFunctionsInvokeErrorMessage(fnError, { functionName: "invite-technician" });
      toast({ title: "Access update failed", description: details, variant: "destructive" });
      return;
    }

    const link = (fnData as any)?.loginLink as string | undefined;
    if (link) setLoginLink(link);
    toast({ title: "Technician access updated", description: "Copy the portal link and share it with the technician." });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : openProp == null ? (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            Set access
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Set technician access</DialogTitle>
          <DialogDescription>
            Set a new password and generate a one-time portal link for {name}. Technicians don’t manage passwords themselves.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={submit} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-2">
                    <FormLabel>New password</FormLabel>
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
                    <Input type="text" autoComplete="new-password" placeholder="Min 8 characters" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {loginLink ? (
              <div className="space-y-2">
                <Label>One-time portal link</Label>
                <div className="flex gap-2">
                  <Input readOnly value={loginLink} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(loginLink);
                      toast({ title: "Copied portal link" });
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <Button type="submit" className="gradient-bg hover:opacity-90 shadow-glow" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save & generate link"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
