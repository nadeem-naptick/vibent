'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ArrowRight, Loader2, AlertCircle, MailCheck } from 'lucide-react';

type Props = { callbackUrl: string; initialError?: string };

const PRIMARY = '#8B3DFF';

export function SignInForm({ callbackUrl, initialError }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    mapInitialError(initialError) ?? null,
  );
  const [needsVerify, setNeedsVerify] = useState(
    initialError === 'EMAIL_NOT_VERIFIED',
  );
  const [resentTo, setResentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNeedsVerify(false);

    const normEmail = email.trim().toLowerCase();

    // Pre-flight check — NextAuth v5 collapses thrown errors into a
    // generic "CredentialsSignin" code, so we can't distinguish
    // wrong-password from unverified-email through it. The precheck
    // endpoint returns one of: 'invalid' | 'unverified' | 'ok'.
    try {
      const pre = await fetch('/api/auth/precheck', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: normEmail, password }),
      });
      const data = (await pre.json().catch(() => ({}))) as { status?: string };

      if (data.status === 'invalid') {
        setError('Invalid email or password.');
        setSubmitting(false);
        return;
      }
      if (data.status === 'unverified') {
        setNeedsVerify(true);
        setSubmitting(false);
        return;
      }
      // status === 'ok' → fall through to NextAuth signIn
    } catch {
      setError('Could not reach the server. Try again.');
      setSubmitting(false);
      return;
    }

    const res = await signIn('credentials', {
      email: normEmail,
      password,
      callbackUrl,
      redirect: false,
    });

    if (res?.error) {
      setError('Invalid email or password.');
      setSubmitting(false);
      return;
    }
    if (res?.ok) {
      router.push(res.url ?? callbackUrl);
      router.refresh();
      return;
    }
    setSubmitting(false);
  }

  async function resendVerification() {
    setResentTo(email.trim().toLowerCase());
    await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    }).catch(() => {});
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}
      {needsVerify && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          <div className="flex items-start gap-2.5">
            <MailCheck size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">Verify your email to sign in</div>
              <div className="mt-1 text-amber-700">
                We sent a verification link when you signed up. Check your
                inbox, or have us send a new one.
              </div>
              <button
                type="button"
                onClick={resendVerification}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
              >
                Resend verification email
              </button>
              {resentTo && (
                <div className="mt-2 text-xs text-amber-700">
                  Sent — check {resentTo}.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Field label="Email">
        <input
          required
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className={inputClass}
        />
      </Field>
      <Field
        label="Password"
        trailing={
          <Link
            href="/forgot-password"
            className="text-xs font-semibold transition-colors"
            style={{ color: PRIMARY }}
          >
            Forgot?
          </Link>
        }
      >
        <input
          required
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className={inputClass}
        />
      </Field>
      <button
        type="submit"
        disabled={submitting || !email || !password}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-[15px] font-semibold text-white transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: PRIMARY }}
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
        Sign in
        {!submitting && <ArrowRight size={16} strokeWidth={2.4} />}
      </button>
    </form>
  );
}

function mapInitialError(err?: string): string | null {
  if (!err) return null;
  if (err === 'CredentialsSignin') return 'Invalid email or password.';
  if (err === 'EMAIL_NOT_VERIFIED') return null;
  return 'Something went wrong. Try again.';
}

function Field({
  label,
  trailing,
  children,
}: {
  label: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {trailing}
      </div>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors';
