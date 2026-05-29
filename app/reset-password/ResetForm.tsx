'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const PRIMARY = '#8B3DFF';

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? 'Could not reset your password.');
      }
      setDone(true);

      // Auto sign-in with the new credentials so the user lands in the
      // dashboard without manually re-entering.
      if (data.email) {
        await signIn('credentials', {
          email: data.email,
          password,
          redirect: false,
        });
        // Give NextAuth a tick to settle, then push.
        setTimeout(() => router.push('/dashboard'), 600);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset your password.');
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600" />
          <div>
            <div className="font-semibold text-emerald-900">Password updated</div>
            <div className="mt-1 text-sm text-emerald-800 leading-relaxed">
              Signing you in…
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
      <Field label="New password">
        <input
          required
          type="password"
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          placeholder="••••••••"
          className={inputClass}
        />
      </Field>
      <Field label="Confirm new password">
        <input
          required
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          placeholder="••••••••"
          className={inputClass}
        />
      </Field>
      <button
        type="submit"
        disabled={submitting || !password || !confirm}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-[15px] font-semibold text-white transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: PRIMARY }}
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
        Update password
        {!submitting && <ArrowRight size={16} strokeWidth={2.4} />}
      </button>
      <div className="text-center text-xs text-slate-400">
        <Link href="/signin" className="hover:text-slate-600 transition-colors">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors';
