import { LogOut } from 'lucide-react';
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
        title="Sign out"
        className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-slate-900/85 text-white/65 hover:text-red-300 hover:border-red-400/30 transition-colors"
      >
        <LogOut size={15} />
      </button>
    </form>
  );
}
