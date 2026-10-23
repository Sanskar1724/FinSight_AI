import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Sparkles } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/components/auth-layout";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Spin } from "@/components/ui/spin";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

type LoginValues = z.infer<typeof schema>;
const DEMO_EMAIL = "demo@finsight.local";
const DEMO_PASSWORD = "Demo@12345";

export default function LoginPage() {
  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const from = (location.state as { from?: string } | null)?.from;

  const form = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const destination = from?.startsWith("/app") ? from : "/app";

  const submit = form.handleSubmit(async (values) => {
    try {
      await login(values.email, values.password);
      toast.success("Welcome back");
      navigate(destination, { replace: true });
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiError ? error.message : "Unable to sign in. Try again.",
      });
    }
  });

  const openDemo = async () => {
    setDemoLoading(true);
    try {
      await demoLogin();
      toast.success("Demo workspace ready");
      navigate("/app", { replace: true });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not open the demo");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-primary">Welcome back</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Sign in to FinSight</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Pick up where you left off. Your workspace is waiting.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
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
            autoComplete="current-password"
            placeholder="Enter your password"
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

          {form.formState.errors.root?.message && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {form.formState.errors.root.message}
            </p>
          )}

          <Button className="w-full" size="lg" type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Spin /> : null}
            Sign in
            {!form.formState.isSubmitting && <ArrowRight className="size-4" />}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            or explore instantly
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          size="lg"
          onClick={openDemo}
          disabled={demoLoading}
        >
          {demoLoading ? <Spin /> : <Sparkles className="size-4 text-primary" />}
          Open the demo workspace
        </Button>
        <button
          type="button"
          onClick={() => {
            form.setValue("email", DEMO_EMAIL);
            form.setValue("password", DEMO_PASSWORD);
            toast.info("Demo credentials filled in");
          }}
          className="mt-2 w-full text-center text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Use demo credentials manually
        </button>

        <p className="mt-7 text-center text-sm text-muted-foreground">
          New to FinSight?{" "}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
