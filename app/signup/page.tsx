import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AuthShell } from '@/components/auth/AuthShell';
import { SignUpForm } from './SignUpForm';

export default async function SignUpPage() {
  const session = await auth();
  if (session?.user) redirect('/dashboard');

  return (
    <AuthShell
      title="Create your account"
      subtitle="Use your work email. We&rsquo;ll send you a verification link."
    >
      <SignUpForm />
      <div className="mt-6 pt-6 border-t border-slate-100 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link
          href="/signin"
          className="font-semibold transition-colors"
          style={{ color: '#8B3DFF' }}
        >
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}
