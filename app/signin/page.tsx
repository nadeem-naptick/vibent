import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  const target = callbackUrl ?? '/dashboard';

  if (session?.user) redirect(target);

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 px-6">
      <form
        action={async (formData) => {
          'use server';
          await signIn('credentials', {
            name: formData.get('name'),
            redirectTo: target,
          });
        }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-widest text-neutral-500">
            Sign in
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Agentic Collaboration Room
          </h1>
        </div>
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm text-neutral-400">
            Your name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            minLength={2}
            autoFocus
            placeholder="Nadeem"
            className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-base placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-neutral-100 text-neutral-950 px-3 py-2 font-medium hover:bg-white transition-colors"
        >
          Continue
        </button>
        <p className="text-xs text-neutral-600 text-center">
          Dev sign-in. Google OAuth and email magic links land later.
        </p>
      </form>
    </main>
  );
}
