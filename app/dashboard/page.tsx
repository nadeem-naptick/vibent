import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms } from '@/lib/db/schema';
import { OBJECTIVE_LABELS } from '@/lib/templates';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { DeleteRoomButton } from '@/components/DeleteRoomButton';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const userRooms = await db
    .select()
    .from(rooms)
    .where(eq(rooms.hostUserId, session.user.id))
    .orderBy(desc(rooms.createdAt));

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight">
            Agentic Collaboration Room
          </h1>
          <span className="text-xs text-neutral-500">
            {session.user.name}
          </span>
        </div>
        <SignOutButton />
      </header>

      <section className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Your rooms</h2>
          <Link
            href="/rooms/new"
            className="rounded-md bg-neutral-100 text-neutral-950 px-4 py-2 text-sm font-medium hover:bg-white transition-colors"
          >
            Create room
          </Link>
        </div>

        {userRooms.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-800 px-6 py-16 text-center space-y-3">
            <p className="text-neutral-400">No rooms yet.</p>
            <Link
              href="/rooms/new"
              className="inline-block text-sm text-neutral-100 underline underline-offset-4 hover:text-white"
            >
              Create your first room →
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3">
            {userRooms.map((room) => (
              <li
                key={room.id}
                className="group relative rounded-lg border border-neutral-900 hover:border-neutral-700 hover:bg-neutral-925 transition-colors"
              >
                <Link href={`/rooms/${room.id}`} className="block px-5 py-4">
                  <div className="flex items-center justify-between gap-4 pr-16">
                    <div className="space-y-1 min-w-0">
                      <div className="font-medium truncate">{room.title}</div>
                      <div className="text-xs text-neutral-500 flex items-center gap-2">
                        <span>{OBJECTIVE_LABELS[room.objective]}</span>
                        <span>·</span>
                        <span>{formatDate(room.createdAt)}</span>
                      </div>
                    </div>
                    <StatusBadge status={room.status} />
                  </div>
                </Link>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DeleteRoomButton roomId={room.id} roomTitle={room.title} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    provisioning: 'bg-amber-950 text-amber-400 border-amber-900',
    active: 'bg-emerald-950 text-emerald-400 border-emerald-900',
    archived: 'bg-neutral-900 text-neutral-500 border-neutral-800',
    error: 'bg-red-950 text-red-400 border-red-900',
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded border ${
        colors[status] ?? colors.archived
      }`}
    >
      {status}
    </span>
  );
}
