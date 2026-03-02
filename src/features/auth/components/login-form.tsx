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

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

function getRecentSignupEmail(): string | null {
  try {
    const email = localStorage.getItem("ff-last-signup-email") ?? "";
    const at = localStorage.getItem("ff-last-signup-at") ?? "";
    if (!email.trim() || !at.trim()) return null;
    const ts = Date.parse(at);
    if (!Number.isFinite(ts)) return null;
    const ageMs = Date.now() - ts;
    if (ageMs < 0) return null;
    // Only nudge for ~24 hours after signup.
    if (ageMs > 24 * 60 * 60 * 1000) return null;
    return email.trim();
  } catch {
    return null;
  }
}

export default function LoginForm() {
  const recentSignupEmail = React.useMemo(() => getRecentSignupEmail(), []);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: recentSignupEmail ?? "", password: "" },
    mode: "onTouched",
  });

  const emailValue = form.watch("email");

  const resendConfirmation = React.useCallback(async () => {
    const valid = await form.trigger("email");
    if (!valid) {
      toastError("Resend failed", "Enter a valid email first.");
      return;
    }

    const email = form.getValues("email").trim();
    try {
      const { error } = await withTimeout(
        supabase.auth.resend({ type: "signup", email }),
        15000,
        "Resend timed out. Check your connection and try again.",
      );
      if (error) {
        toastError("Resend failed", error.message);
        return;
      }
      toastSuccess("Confirmation email sent", "Check your inbox (and spam folder), then try signing in again.");
    } catch (e: any) {
      toastError("Resend failed", e?.message ?? "Network error");
    }
  }, [form]);

  const emailLoginLink = React.useCallback(async () => {
    const valid = await form.trigger("email");
    if (!valid) {
      toastError("Email login failed", "Enter a valid email first.");
      return;
    }

    const email = form.getValues("email").trim();
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithOtp({
          email,
          shouldCreateUser: false,
          options: { emailRedirectTo: `${getPublicSiteUrl()}/auth/callback?next=/portal` },
        }),
        15000,
        "Request timed out. Check your connection and try again.",
      );
      if (error) {
        toastError("Email login failed", error.message);
        return;
      }
      toastSuccess("Login link sent", "Check your inbox (and spam folder).");
    } catch (e: any) {
      toastError("Email login failed", e?.message ?? "Network error");
    }
  }, [form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        }),
        15000,
        "Sign-in timed out. Check your connection and try again.",
      );
      if (error) {
        const msg = String(error.message ?? "");
        const lower = msg.toLowerCase();
        if (lower.includes("email not confirmed")) {
          toastError("Login failed", "Confirm your email first, then sign in. Use “Resend confirmation email” if you need a new link.");
          return;
        }
        if (lower.includes("invalid login credentials")) {
          toastError("Login failed", "Invalid email or password. If you just signed up, confirm your email first.");
          return;
        }
        toastError("Login failed", msg || "Sign-in failed");
        return;
      }
      if (!data.session) {
        toastError("Login failed", "No session returned. Try again.");
        return;
      }
      try {
        localStorage.removeItem("ff-last-signup-email");
        localStorage.removeItem("ff-last-signup-at");
      } catch {
        // ignore
      }
      toastSuccess("Logged in successfully");
    } catch (e: any) {
      toastError("Login failed", e?.message ?? "Network error");
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-bold">Log in</div>
        <div className="text-sm text-muted-foreground">Access your FieldFlow workspace.</div>
      </div>

      {recentSignupEmail ? (
        <Alert>
          <AlertTitle>Just created an account?</AlertTitle>
          <AlertDescription>
            <p>
              Your email may need to be confirmed before you can sign in. If you didn’t get the email, resend it to{" "}
              <span className="font-medium text-foreground">{recentSignupEmail}</span>.
            </p>
            <div className="mt-3 flex items-center gap-2">
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
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                </div>
                <FormControl>
                  <Input type="password" autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full gradient-bg hover:opacity-90 shadow-glow" disabled={form.formState.isSubmitting}>
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

      <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3">
        <div className="text-sm font-medium">Prefer an email login link?</div>
        <div className="mt-1 text-xs text-muted-foreground">
          We'll email you a login button. This is the recommended way to access the quote portal.
        </div>
        <div className="mt-3">
          <Button type="button" variant="outline" size="sm" onClick={emailLoginLink} disabled={form.formState.isSubmitting || !emailValue}>
            Email me a login link
          </Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/plan-wizard" className="text-primary hover:underline">
          Create your company account
        </Link>
        .
      </div>
    </div>
  );
}
