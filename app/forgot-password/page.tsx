import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { ForgotForm } from './ForgotForm';

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to set a new one."
    >
      <ForgotForm />
      <div className="mt-6 pt-6 border-t border-slate-100 text-center text-sm text-slate-500">
        Remembered it?{' '}
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
