import { ArrowLeft } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";
import { Link } from "react-router-dom";

import { Brand } from "@/components/brand";
import { REPOSITORY_ISSUES_URL, usePublicConfig } from "@/hooks/use-public-config";

export const LEGAL_LAST_UPDATED = "24 October 2026";

export function LegalLayout({
  title,
  intro,
  children,
}: PropsWithChildren<{ title: string; intro: ReactNode }>) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 sm:px-8">
          <Brand />
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-primary">
          Last updated {LEGAL_LAST_UPDATED}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{title}</h1>
        <div className="mt-4 text-sm leading-relaxed text-muted-foreground">{intro}</div>
        <div className="mt-10 space-y-8">{children}</div>
        <footer className="mt-14 flex flex-wrap gap-x-5 gap-y-2 border-t border-border/70 pt-6 text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            Terms of Service
          </Link>
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
        </footer>
      </main>
    </div>
  );
}

export function LegalSection({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-[-0.02em]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/80 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}

/** The support contact configured on the server, or the repository issues page. */
export function ContactLink() {
  const config = usePublicConfig();
  const email = config.data?.support_email;
  if (email) {
    return (
      <a href={`mailto:${email}`} className="font-semibold text-primary hover:underline">
        {email}
      </a>
    );
  }
  return (
    <a
      href={REPOSITORY_ISSUES_URL}
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-primary hover:underline"
    >
      the project&apos;s GitHub Issues page
    </a>
  );
}
