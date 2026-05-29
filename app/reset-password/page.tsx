import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { ResetForm } from './ResetForm';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthShell
        title="Missing reset link"
        subtitle="This page needs a valid reset token from your email."
      >
        <Link
          href="/forgot-password"
          className="inline-flex items-center justify-center w-full gap-2 rounded-lg px-5 py-3 text-[15px] font-semibold text-white shadow-sm"
          style={{ backgroundColor: '#8B3DFF' }}
        >
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Make it at least 8 characters, with a letter and a number."
    >
      <ResetForm token={token} />
    </AuthShell>
  );
}
