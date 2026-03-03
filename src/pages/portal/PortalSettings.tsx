import * as React from "react";
import PageHeader from "@/features/dashboard/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function PortalSettings() {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = password.trim();
    const c = confirm.trim();

    if (p.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (p !== c) {
      toast({ title: "Passwords don’t match", description: "Please confirm the same password.", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase.auth.updateUser({ password: p });
      if (error) {
        toast({ title: "Password update failed", description: error.message, variant: "destructive" });
        return;
      }
      setPassword("");
      setConfirm("");
      toast({ title: "Password updated", description: "You can now sign in with email + password." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage your portal access." />

      <Card className="border-border/40">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Set a password</CardTitle>
          <CardDescription>
            You can keep using emailed login links, or set a password for email + password sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3 max-w-sm" onSubmit={submit}>
            <div className="grid gap-2">
              <label className="text-sm font-medium">New password</label>
              <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Confirm password</label>
              <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

