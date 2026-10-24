import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

import { AuthLayout } from "@/components/auth-layout";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Spin } from "@/components/ui/spin";
import { api, ApiError } from "@/lib/api";

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address"),
});

type ForgotValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<ForgotValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await api.post("/auth/forgot-password", { email: values.email });
      setSentTo(values.email.trim());
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiError ? error.message : "Could not send the email. Try again.",
      });
    }
  });

  return (
    <AuthLayout>
      {sentTo ? (
        <div>
          <span className="grid size-12 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
            <MailCheck className="size-5" />
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">Check your inbox</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            If an account exists for <span className="font-semibold text-foreground">{sentTo}</span>,
            we&apos;ve sent a link to choose a new password. It works for 30 minutes. Check your spam
            folder if it doesn&apos;t arrive in a few minutes.
          </p>
          <div className="mt-8 flex flex-col gap-2">
            <Button asChild size="lg">
              <Link to="/login">Back to sign in</Link>
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSentTo(null)}>
              Use a different email
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-primary">
            Account recovery
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Forgot your password?</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Enter the email you signed up with and we&apos;ll send you a link to choose a new one.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <FormField
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              autoFocus
              error={form.formState.errors.email?.message}
              {...form.register("email")}
            />
            {form.formState.errors.root?.message && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                {form.formState.errors.root.message}
              </p>
            )}
            <Button className="w-full" size="lg" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Spin /> : null}
              Send reset link
            </Button>
          </form>

          <Link
            to="/login"
            className="mt-7 inline-flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to sign in
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
