'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Layers3,
  Loader2,
  Sparkles,
  Plug,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { AtmosphericBackground } from '@/components/AtmosphericBackground';

type Mode = 'reattach' | 'restore' | 'unknown' | 'error';

const COPY: Record<Mode, { title: string; subtitle: string; etaSeconds: number; icon: typeof Loader2 }> = {
  unknown: {
    title: 'Checking your sandbox',
    subtitle: "We're seeing whether your workspace is still warm or needs to be brought back up.",
    etaSeconds: 5,
    icon: Loader2,
  },
  reattach: {
    title: 'Reconnecting to your sandbox',
    subtitle:
      "Your sandbox is still alive at our provider — we just need to grab a fresh handle on it. This is usually fast.",
    etaSeconds: 8,
    icon: Plug,
  },
  restore: {
    title: 'Rebuilding your workspace',
    subtitle:
      "Your previous sandbox went to sleep, so we're spinning up a fresh one from the latest saved version. This installs dependencies and starts the Vite dev server.",
    etaSeconds: 75,
    icon: Sparkles,
  },
  error: {
    title: 'Could not restore your sandbox',
    subtitle:
      "Something went wrong bringing your workspace back. You can try again or recreate the sandbox from scratch.",
    etaSeconds: 0,
    icon: AlertCircle,
  },
};

export function RoomLoadingScreen({
  mode,
  roomTitle,
  onRetry,
  onRecreate,
}: {
  mode: Mode;
  roomTitle: string;
  onRetry?: () => void;
  onRecreate?: () => void;
}) {
  const copy = COPY[mode];
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (mode === 'error') return;
    const startedAt = Date.now();
    const i = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(i);
  }, [mode]);

  const Icon = copy.icon;
  const progress =
    mode === 'error' ? 0 : Math.min(0.95, elapsed / Math.max(copy.etaSeconds, 1));
  const overdue = mode !== 'error' && elapsed > copy.etaSeconds * 1.5;

  return (
    <main className="relative min-h-screen text-white">
      <AtmosphericBackground />

      <header className="relative z-10 border-b border-white/8 bg-black/30 backdrop-blur-2xl">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            Back to dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-500 text-white shadow-[0_0_28px_rgba(79,140,255,.42)]">
              <Layers3 size={18} />
            </div>
          </div>
        </div>
      </header>

      <section className="relative z-10 max-w-2xl mx-auto px-6 py-20">
        <div className="rounded-[28px] border border-white/8 bg-slate-900/60 backdrop-blur-2xl p-10 shadow-2xl text-center space-y-6">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-blue-500/15 text-blue-200 relative">
            <Icon
              size={36}
              className={mode === 'error' ? 'text-red-300' : 'animate-spin-slow'}
              style={mode === 'error' ? undefined : { animation: 'spin 2.4s linear infinite' }}
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-widest text-white/40">
              {roomTitle}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {copy.title}
            </h1>
            <p className="text-sm text-white/55 leading-relaxed max-w-md mx-auto">
              {copy.subtitle}
            </p>
          </div>

          {mode !== 'error' && (
            <>
              <div className="mx-auto max-w-xs">
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-500 transition-[width] duration-500 ease-out"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-white/45 tabular-nums">
                  <span>{elapsed}s elapsed</span>
                  <span>
                    {overdue
                      ? 'Taking longer than usual…'
                      : `~${copy.etaSeconds}s expected`}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3 text-left">
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
                  Why am I waiting?
                </div>
                <p className="text-xs text-white/60 leading-relaxed">
                  Each room runs its own isolated Vite dev sandbox so the agent can
                  modify code live. Sandboxes pause between sessions to save resources
                  and need a moment to wake up.
                </p>
              </div>
            </>
          )}

          {mode === 'error' && (
            <div className="flex items-center justify-center gap-3 pt-2">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] text-white px-5 py-2.5 text-sm font-medium hover:bg-white/[0.1] transition-colors"
                >
                  Try again
                </button>
              )}
              {onRecreate && (
                <button
                  onClick={onRecreate}
                  className="inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-blue-500/25 text-blue-50 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500/35 transition-colors"
                >
                  Recreate sandbox
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
