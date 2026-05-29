'use client';

import { useState } from 'react';
import { ArrowRight, Loader2, AlertCircle, MailCheck, MailX } from 'lucide-react';

const PRIMARY = '#8B3DFF';

export function SignUpForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: string; emailSent: boolean; emailError?: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? 'Could not create your account.');
      }
      setDone({
        email: data.email ?? email.trim().toLowerCase(),
        emailSent: data.emailSent !== false,
        emailError: data.emailError,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    if (done.emailSent) {
      return (
        <div className="space-y-5">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
            <MailCheck size={18} className="shrink-0 mt-0.5 text-emerald-600" />
            <div>
              <div className="font-semibold text-emerald-900">Check your inbox</div>
              <div className="mt-1 text-sm text-emerald-800 leading-relaxed">
                We sent a verification link to <b>{done.email}</b>. Click it to
                confirm your account, then come back to sign in.
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Wrong email or link didn&apos;t arrive within a minute? Try{' '}
            <a
              href="/signin"
              className="font-semibold transition-colors"
              style={{ color: PRIMARY }}
            >
              signing in
            </a>{' '}
            and resending the verification from there.
          </div>
        </div>
      );
    }
    // Account created but email send failed — show the actual problem.
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <MailX size={18} className="shrink-0 mt-0.5 text-amber-600" />
          <div>
            <div className="font-semibold text-amber-900">
              Account created, but we couldn&apos;t send the verification email
            </div>
            <div className="mt-1 text-sm text-amber-800 leading-relaxed">
              Your account for <b>{done.email}</b> is in the database. Email
              delivery failed because the server&apos;s email provider is in
              testing mode (Resend sandbox only allows sending to the account
              owner&apos;s email until a domain is verified).
            </div>
            {done.emailError && (
              <div className="mt-3 rounded bg-amber-100 px-2.5 py-2 font-mono text-[11px] text-amber-900 break-all">
                {done.emailError}
              </div>
            )}
            <div className="mt-3 text-sm text-amber-800">
              <b>Fix:</b> the project owner needs to verify a domain on
              Resend (resend.com/domains). Once verified, emails will deliver
              to any address.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      <Field label="Name">
        <input
          required
          type="text"
          autoComplete="name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nadeem Shaikh"
          minLength={2}
          maxLength={80}
          className={inputClass}
        />
      </Field>
      <Field label="Work email">
        <input
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className={inputClass}
        />
      </Field>
      <Field label="Password" sub="At least 8 characters, with a letter and a number.">
        <input
          required
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          minLength={8}
          className={inputClass}
        />
      </Field>
      <button
        type="submit"
        disabled={submitting || !name || !email || !password}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-[15px] font-semibold text-white transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: PRIMARY }}
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
        Create account
        {!submitting && <ArrowRight size={16} strokeWidth={2.4} />}
      </button>
      <p className="text-xs text-slate-400">
        By creating an account you agree to our terms and privacy notice.
      </p>
    </form>
  );
}

function Field({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {sub && <span className="ml-2 text-xs text-slate-400">{sub}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors';
