"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function LoginForm() {
  const { login, status } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace(next.startsWith("/") ? next : "/dashboard");
  }, [status, next, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Can't reach the server. Is the backend running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft px-3.5 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <Field label="Email" name="email" type="email" autoComplete="username" required
        placeholder="you@clinic.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required
        placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Button type="submit" className="h-11 w-full" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-secondary p-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary font-display text-xl font-semibold">P</span>
          <span className="font-display text-xl font-semibold">PhysioDesk</span>
        </div>
        <div className="my-auto max-w-md">
          <h1 className="font-display text-5xl font-semibold leading-[1.1]">
            Care that runs <span className="text-primary">on schedule.</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-white/65">
            Patients, appointments, billing and your therapists&apos; day, all in one calm place.
          </p>
          <ul className="mt-10 space-y-3 text-sm text-white/80">
            {["Double-booking prevented automatically", "Live capacity for every therapist", "Invoices in seconds"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-tertiary" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/40">© PhysioDesk</p>
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-secondary-light" />
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center bg-canvas px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-3xl font-semibold text-ink">Welcome back</h2>
          <p className="mb-8 mt-2 text-sm text-muted">Sign in to your clinic workspace.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}