import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect('/dashboard');

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 px-6">
      <div className="max-w-xl text-center space-y-8">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-neutral-500">
            Milestone 1 — preview
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
            Agentic Collaboration Room
          </h1>
          <p className="text-lg text-neutral-400 leading-relaxed">
            A live execution workspace. Teams discuss, decide, and watch the
            product artifact take shape in real time.
          </p>
        </div>
        <Link
          href="/signin"
          className="inline-block rounded-md bg-neutral-100 text-neutral-950 px-6 py-3 font-medium hover:bg-white transition-colors"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
