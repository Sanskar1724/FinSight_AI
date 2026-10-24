import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/components/auth-layout";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Spin } from "@/components/ui/spin";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";

const schema = z
  .object({
    name: z.string().trim().min(2, "Use at least 2 characters").max(120),
    email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(128, "Use 128 characters or fewer"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    acceptTerms: z.boolean().refine((value) => value, {
      message: "Please accept the Terms of Service and Privacy Policy",
    }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type RegisterValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", acceptTerms: false },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await registerUser(values.name, values.email, values.password);
      toast.success("Your workspace is ready");
      navigate("/app", { replace: true });
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiError ? error.message : "Unable to create your account.",
      });
    }
  });

  return (
    <AuthLayout>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-primary">
          Start your workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Create your account</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          A private, grounded view of your money. No bank credentials, ever.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
          <FormField
            label="Your name"
            autoComplete="name"
            placeholder="Ananya Sharma"
            error={form.formState.errors.name?.message}
            {...form.register("name")}
          />
          <FormField
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />
          <FormField
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            error={form.formState.errors.password?.message}
            hint="Use a unique password for FinSight."
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
            label="Confirm password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repeat your password"
            error={form.formState.errors.confirmPassword?.message}
            {...form.register("confirmPassword")}
          />

          <div>
            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-input accent-[hsl(var(--primary))]"
                aria-invalid={Boolean(form.formState.errors.acceptTerms)}
                {...form.register("acceptTerms")}
              />
              <span>
                I&apos;m 18 or older and I agree to the{" "}
                <Link to="/terms" target="_blank" className="font-semibold text-primary hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy" target="_blank" className="font-semibold text-primary hover:underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {form.formState.errors.acceptTerms?.message && (
              <p className="mt-1.5 text-[11px] font-medium text-rose-600">
                {form.formState.errors.acceptTerms.message}
              </p>
            )}
          </div>

          {form.formState.errors.root?.message && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {form.formState.errors.root.message}
            </p>
          )}

          <Button className="w-full" size="lg" type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Spin /> : <Check className="size-4" />}
            Create account
            {!form.formState.isSubmitting && <ArrowRight className="ml-auto size-4" />}
          </Button>
        </form>

        <p className="mt-4 text-center text-[10px] leading-relaxed text-muted-foreground">
          By creating an account, you agree that FinSight is a planning tool and not a bank,
          lender, or investment adviser.
        </p>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
