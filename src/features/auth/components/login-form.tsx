import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toastSuccess, toastError } from "@/lib/toast-helpers";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/with-timeout";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Mail } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

type LoginFormProps = {
  heading?: string;
  description?: string;
  showMagicLink?: boolean;
  showCreateAccount?: boolean;
  callbackNext?: string;
};

function getRecentSignupEmail(): string | null {
  try {
    const email = localStorage.getItem("ff-last-signup-email") ?? "";
    const at = localStorage.getItem("ff-last-signup-at") ?? "";
    if (!email.trim() || !at.trim()) return null;
    const ts = Date.parse(at);
    if (!Number.isFinite(ts)) return null;
    const ageMs = Date.now() - ts;
    if (ageMs < 0 || ageMs > 24 * 60 * 60 * 1000) return null;
    return email.trim();
  } catch {
    return null;
  }
}

export default function LoginForm({
  heading = "Log in",
  description = "Access your FieldFlow workspace.",
  showMagicLink = false,
  showCreateAccount = true,
  callbackNext = "/dashboard",
}: LoginFormProps) {
  const recentSignupEmail = React.useMemo(() => getRecentSignupEmail(), []);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: recentSignupEmail ?? "", password: "" },
    mode: "onTouched",
  });

  const emailValue = form.watch("email");

  const resendConfirmation = React.useCallback(async () => {
    const valid = await form.trigger("email");
    if (!valid) { toastError("Resend failed", "Enter a valid email first."); return; }
    const email = form.getValues("email").trim();
    try {
      const { error } = await withTimeout(
        supabase.auth.resend({ type: "signup", email }),
        15000, "Resend timed out.",
      );
      if (error) { toastError("Resend failed", error.message); return; }
      toastSuccess("Confirmation email sent", "Check your inbox (and spam folder), then try signing in again.");
    } catch (e: any) {
      toastError("Resend failed", e?.message ?? "Network error");
    }
  }, [form]);

  const emailLoginLink = React.useCallback(async () => {
    const valid = await form.trigger("email");
    if (!valid) { toastError("Email login failed", "Enter a valid email first."); return; }
    const email = form.getValues("email").trim();
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${getPublicSiteUrl()}/auth/callback?next=${encodeURIComponent(callbackNext)}`,
            shouldCreateUser: false,
          },
        }),
        15000, "Request timed out.",
      );
      if (error) { toastError("Email login failed", error.message); return; }
      toastSuccess("Login link sent", "Check your inbox (and spam folder).");
    } catch (e: any) {
      toastError("Email login failed", e?.message ?? "Network error");
    }
  }, [form, callbackNext]);

  const submit = form.handleSubmit(async (values) => {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email: values.email, password: values.password }),
        15000, "Sign-in timed out.",
      );
      if (error) {
        const msg = String(error.message ?? "");
        const lower = msg.toLowerCase();
        if (lower.includes("email not confirmed")) {
          toastError("Login failed", 'Confirm your email first, then sign in. Use "Resend confirmation" if you need a new link.');
          return;
        }
        if (lower.includes("invalid login credentials")) {
          toastError("Login failed", "Invalid email or password. If you just signed up, confirm your email first.");
          return;
        }
        toastError("Login failed", msg || "Sign-in failed");
        return;
      }
      if (!data.session) { toastError("Login failed", "No session returned. Try again."); return; }
      try {
        localStorage.removeItem("ff-last-signup-email");
        localStorage.removeItem("ff-last-signup-at");
      } catch {}
      toastSuccess("Logged in successfully");
    } catch (e: any) {
      toastError("Login failed", e?.message ?? "Network error");
    }
  });

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xl font-bold">{heading}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>

      {recentSignupEmail ? (
        <Alert>
          <AlertTitle>Just created an account?</AlertTitle>
          <AlertDescription>
            <p>
              Your email may need to be confirmed. Resend to{" "}
              <span className="font-medium text-foreground">{recentSignupEmail}</span>.
            </p>
            <div className="mt-3">
              <Button type="button" variant="outline" size="sm" onClick={resendConfirmation} disabled={form.formState.isSubmitting}>
                Resend confirmation email
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <Form {...form}>
        <form onSubmit={submit} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="you@company.com" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Signing in..." : "Sign in"}
          </Button>

          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={resendConfirmation}
              disabled={form.formState.isSubmitting || !emailValue}
            >
              Resend confirmation email
            </Button>
          </div>
        </form>
      </Form>

      {showMagicLink && (
        <div className="rounded-lg border border-border/40 bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Mail className="h-4 w-4 text-primary" />
            Prefer a passwordless login?
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            We'll email you a one-click login button. No password needed.
          </div>
          <div className="mt-3">
            <Button type="button" variant="outline" size="sm" onClick={emailLoginLink} disabled={form.formState.isSubmitting || !emailValue}>
              Email me a login link
            </Button>
          </div>
        </div>
      )}

      {showCreateAccount && (
        <div className="text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/plan-wizard" className="text-primary hover:underline">
            Create your company account
          </Link>
          .
        </div>
      )}
    </div>
  );
}
