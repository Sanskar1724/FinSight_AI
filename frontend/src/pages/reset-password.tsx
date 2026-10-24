import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, KeyRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/components/auth-layout";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Spin } from "@/components/ui/spin";
import { api, ApiError } from "@/lib/api";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(128, "Use at most 128 characters"),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });

type ResetValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<ResetValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await api.post("/auth/reset-password", { token, password: values.password });
      toast.success("Password updated. Sign in with your new password.");
      navigate("/login", { replace: true });
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof ApiError ? error.message : "Could not reset your password. Try again.",
      });
    }
  });

  if (!token) {
    return (
      <AuthLayout>
        <h1 className="text-3xl font-semibold tracking-[-0.04em]">This link is incomplete</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Open the reset link from your email again, or request a new one.
        </p>
        <Button asChild size="lg" className="mt-8 w-full">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <span className="grid size-12 place-items-center rounded-2xl border border-primary/15 bg-primary/5 text-primary">
        <KeyRound className="size-5" />
      </span>
      <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">Choose a new password</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        After you save it, every device signed in to your account is signed out.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <FormField
          label="New password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          autoFocus
          error={form.formState.errors.password?.message}
          action={
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {showPassword ? "Hide" : "Show"}
            </button>
          }
          {...form.register("password")}
        />
        <FormField
          label="Confirm new password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          error={form.formState.errors.confirm?.message}
          {...form.register("confirm")}
        />
        {form.formState.errors.root?.message && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
            {form.formState.errors.root.message}{" "}
            <Link to="/forgot-password" className="font-semibold underline">
              Request a new link
            </Link>
          </div>
        )}
        <Button className="w-full" size="lg" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spin /> : null}
          Save new password
          {!form.formState.isSubmitting && <ArrowRight className="size-4" />}
        </Button>
      </form>
    </AuthLayout>
  );
}
