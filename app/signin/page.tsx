import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AuthShell } from '@/components/auth/AuthShell';
import { SignInForm } from './SignInForm';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const { callbackUrl, error } = await searchParams;
  const target = callbackUrl ?? '/dashboard';

  if (session?.user) redirect(target);

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your vibemtg account."
    >
      <SignInForm callbackUrl={target} initialError={error} />
      <div className="mt-6 pt-6 border-t border-slate-100 text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="font-semibold transition-colors"
          style={{ color: '#8B3DFF' }}
        >
          Create one
        </Link>
      </div>
    </AuthShell>
  );
}
