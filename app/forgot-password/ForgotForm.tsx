'use client';

import { useState } from 'react';
import { ArrowRight, Loader2, MailCheck } from 'lucide-react';

const PRIMARY = '#8B3DFF';

export function ForgotForm() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // The /api/auth/forgot endpoint always returns 200 even if the email
      // doesn't exist, so we don't need to gate on the response shape.
      await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
    } catch {
      // Swallow — UX is the same either way (intentional, prevents
      // enumeration).
    } finally {
      setSent(true);
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
        <MailCheck size={18} className="shrink-0 mt-0.5 text-emerald-600" />
        <div>
          <div className="font-semibold text-emerald-900">Check your inbox</div>
          <div className="mt-1 text-sm text-emerald-800 leading-relaxed">
            If an account exists for <b>{email.trim().toLowerCase()}</b>, we&apos;ve
            sent a link to set a new password. It expires in 1 hour.
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Email</span>
        <div className="mt-1.5">
          <input
            required
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors"
          />
        </div>
      </label>
      <button
        type="submit"
        disabled={submitting || !email}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-[15px] font-semibold text-white transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: PRIMARY }}
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
        Send reset link
        {!submitting && <ArrowRight size={16} strokeWidth={2.4} />}
      </button>
    </form>
  );
}
