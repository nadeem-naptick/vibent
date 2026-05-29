import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { ArrowLeft, Layers3 } from 'lucide-react';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { withDefaults } from '@/lib/user-preferences';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { AtmosphericBackground } from '@/components/AtmosphericBackground';
import { SettingsForm } from './SettingsForm';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const [row] = await db
    .select({
      name: users.name,
      email: users.email,
      preferences: users.preferences,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!row) redirect('/signin');

  const preferences = withDefaults(row.preferences);

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
            <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-500/85 text-white shadow-[0_0_24px_rgba(79,140,255,.4)]">
              <Layers3 size={17} />
            </div>
          </div>
        </div>
      </header>

      <section className="relative z-10 max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-2 text-sm text-white/55">
            Account info and the defaults applied to every room you create.
          </p>
        </div>

        <SettingsForm
          initialName={row.name ?? ''}
          email={row.email ?? ''}
          initialPreferences={preferences}
        />

        <div className="mt-12 pt-8 border-t border-white/8 flex items-center justify-between">
          <div className="text-sm text-white/55">
            Need to sign out of this device?
          </div>
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
