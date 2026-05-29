import Link from 'next/link';
import { Sparkles } from 'lucide-react';

// Shared visual wrapper for all auth pages (signin / signup / forgot /
// reset / verify status). Matches the violet/white aesthetic of the
// landing page so the flow feels continuous.
export function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <main
      className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 py-12"
      style={{
        fontFamily: 'var(--font-public-sans), ui-sans-serif, system-ui, sans-serif',
        backgroundImage:
          'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(139,61,255,0.10), transparent 60%)',
      }}
    >
      <Link href="/" className="flex items-center gap-2.5 mb-10">
        <div
          className="grid h-9 w-9 place-items-center rounded-lg"
          style={{ backgroundColor: '#8B3DFF' }}
        >
          <Sparkles size={16} className="text-white" strokeWidth={2.4} />
        </div>
        <span className="text-xl font-bold tracking-tight text-slate-900">vibemtg</span>
      </Link>

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-[15px] text-slate-500 leading-relaxed">{subtitle}</p>
          )}
        </div>
        {children}
      </div>

      <p className="mt-8 text-xs text-slate-400">vibemtg · meet · think · generate</p>
    </main>
  );
}
