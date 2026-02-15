import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toastSuccess, toastError, toastInfo } from "@/lib/toast-helpers";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import { supabase } from "@/integrations/supabase/client";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

const signupSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  companyCode: z.string().optional(),
});

type SignupValues = z.infer<typeof signupSchema>;

export default function SignupForm() {
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", companyCode: "" },
    mode: "onTouched",
  });

  const submit = form.handleSubmit(async (values) => {
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.name },
        emailRedirectTo: `${getPublicSiteUrl()}/auth/callback`,
      },
    });
    if (error) {
      toastError("Signup failed", error.message);
      return;
    }
    toastInfo(
      "Account created",
      "Check your email to confirm your account before signing in.",
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-bold">Create your account</div>
        <div className="text-sm text-muted-foreground">Join your team's workspace.</div>
      </div>

      <Form {...form}>
        <form onSubmit={submit} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Your name" autoComplete="name" {...field} />
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
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="companyCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company code (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Provided by your admin" autoComplete="one-time-code" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full gradient-bg hover:opacity-90 shadow-glow" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Creating..." : "Create account"}
          </Button>
        </form>
      </Form>

      <div className="text-sm text-muted-foreground">
        Starting FieldFlow for your business?{" "}
        <Link to="/company-signup" className="text-primary hover:underline">
          Create a company account
        </Link>
        .
      </div>
    </div>
  );
}
