import { signOut } from '@/auth';

export function SignOutButton() {
  return (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/signin' });
      }}
    >
      <button
        type="submit"
        className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        Sign out
      </button>
    </form>
  );
}
