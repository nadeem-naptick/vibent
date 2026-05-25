import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Layers3 } from 'lucide-react';
import { auth } from '@/auth';
import { CreateRoomForm } from './CreateRoomForm';
import { AtmosphericBackground } from '@/components/AtmosphericBackground';
import { SignOutButton } from '@/components/auth/SignOutButton';

export default async function NewRoomPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  return (
    <main className="relative min-h-screen text-white">
      <AtmosphericBackground />

      <header className="relative z-10 border-b border-white/8 bg-black/30 backdrop-blur-2xl">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            Back to dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-500 text-white shadow-[0_0_28px_rgba(79,140,255,.42)]">
              <Layers3 size={18} />
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <section className="relative z-10 max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-white/40 mb-1">
            New room
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Spin up a workspace
          </h1>
          <p className="text-sm text-white/55 mt-1.5">
            Pick an objective and a template. The agent provisions a sandbox
            and waits for your team to start talking.
          </p>
        </div>

        <div className="rounded-[28px] border border-white/8 bg-slate-900/50 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
          <CreateRoomForm />
        </div>
      </section>
    </main>
  );
}
