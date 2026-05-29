import Link from 'next/link';
import { CheckCircle2, AlertCircle, MailCheck } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';

const PRIMARY = '#8B3DFF';

type Status = 'ok' | 'invalid' | 'missing';

export default async function VerifyEmailStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: raw } = await searchParams;
  const status: Status =
    raw === 'ok' || raw === 'invalid' || raw === 'missing' ? raw : 'invalid';

  const copy = STATUS_COPY[status];

  return (
    <AuthShell title={copy.title} subtitle={copy.subtitle}>
      <div className={`rounded-lg border p-4 flex items-start gap-3 ${copy.cardClass}`}>
        <copy.icon size={18} className={`shrink-0 mt-0.5 ${copy.iconClass}`} />
        <div>
          <div className={`font-semibold ${copy.titleClass}`}>{copy.cardTitle}</div>
          <div className={`mt-1 text-sm leading-relaxed ${copy.bodyClass}`}>
            {copy.cardBody}
          </div>
        </div>
      </div>
      <Link
        href={copy.cta.href}
        className="mt-6 inline-flex items-center justify-center w-full gap-2 rounded-lg px-5 py-3 text-[15px] font-semibold text-white shadow-sm hover:shadow transition-all"
        style={{ backgroundColor: PRIMARY }}
      >
        {copy.cta.label}
      </Link>
    </AuthShell>
  );
}

const STATUS_COPY: Record<
  Status,
  {
    title: string;
    subtitle?: string;
    icon: typeof CheckCircle2;
    cardTitle: string;
    cardBody: string;
    cardClass: string;
    iconClass: string;
    titleClass: string;
    bodyClass: string;
    cta: { label: string; href: string };
  }
> = {
  ok: {
    title: 'Email verified',
    subtitle: 'Your account is ready to use.',
    icon: CheckCircle2,
    cardTitle: 'All set',
    cardBody:
      'You can now sign in. The next screen will take you to your dashboard.',
    cardClass: 'border-emerald-200 bg-emerald-50',
    iconClass: 'text-emerald-600',
    titleClass: 'text-emerald-900',
    bodyClass: 'text-emerald-800',
    cta: { label: 'Sign in', href: '/signin' },
  },
  invalid: {
    title: 'This link is invalid or expired',
    subtitle: "Verification links work once and expire after 24 hours.",
    icon: AlertCircle,
    cardTitle: "Couldn't verify",
    cardBody:
      'Sign in with your email and password, and we&apos;ll let you request a fresh verification link.',
    cardClass: 'border-amber-200 bg-amber-50',
    iconClass: 'text-amber-600',
    titleClass: 'text-amber-900',
    bodyClass: 'text-amber-800',
    cta: { label: 'Go to sign in', href: '/signin' },
  },
  missing: {
    title: 'No verification token',
    subtitle: 'This page expects a token in the URL.',
    icon: MailCheck,
    cardTitle: "We can't verify without a token",
    cardBody:
      'Open the verification link from your email, or request a new one from the sign-in page.',
    cardClass: 'border-slate-200 bg-slate-50',
    iconClass: 'text-slate-500',
    titleClass: 'text-slate-900',
    bodyClass: 'text-slate-600',
    cta: { label: 'Go to sign in', href: '/signin' },
  },
};
