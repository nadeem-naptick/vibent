import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { Plus, Sparkles, Layers3 } from 'lucide-react';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms } from '@/lib/db/schema';
import { OBJECTIVE_LABELS, getTemplate } from '@/lib/templates';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { DeleteRoomButton } from '@/components/DeleteRoomButton';
import { AtmosphericBackground } from '@/components/AtmosphericBackground';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const userRooms = await db
    .select()
    .from(rooms)
    .where(eq(rooms.hostUserId, session.user.id))
    .orderBy(desc(rooms.createdAt));

  const initial = (session.user.name ?? '?')[0]?.toUpperCase() ?? '?';

  return (
    <main className="relative min-h-screen text-white">
      <AtmosphericBackground />

      <header className="relative z-10 border-b border-white/8 bg-black/30 backdrop-blur-2xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-500 text-white shadow-[0_0_34px_rgba(79,140,255,.42)]">
              <Layers3 size={20} />
            </div>
            <div>
              <div className="text-base font-semibold">Agentic Collaboration Room</div>
              <div className="text-xs text-white/45">Live execution workspace</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/85 px-3 py-1.5">
              <div className="grid h-6 w-6 place-items-center rounded-full bg-blue-500/25 text-blue-100 text-xs font-semibold">
                {initial}
              </div>
              <span className="text-sm text-white/80">{session.user.name}</span>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <section className="relative z-10 max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/40 mb-1">
              Your workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Rooms</h1>
            <p className="text-sm text-white/55 mt-1">
              {userRooms.length === 0
                ? 'Spin up your first room to start collaborating with the agent.'
                : `${userRooms.length} ${userRooms.length === 1 ? 'room' : 'rooms'} · click any to enter`}
            </p>
          </div>
          <Link
            href="/rooms/new"
            className="inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-blue-500/25 text-blue-50 px-5 py-3 text-sm font-semibold shadow-2xl backdrop-blur-2xl hover:bg-blue-500/35 transition-colors"
          >
            <Plus size={18} strokeWidth={2.4} />
            Create room
          </Link>
        </div>

        {userRooms.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid gap-3">
            {userRooms.map((room) => (
              <RoomCard
                key={room.id}
                roomId={room.id}
                title={room.title}
                templateId={room.templateId}
                objectiveLabel={room.objective ? OBJECTIVE_LABELS[room.objective] : null}
                createdAt={room.createdAt}
                status={room.status}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-900/40 backdrop-blur-2xl px-8 py-20 text-center space-y-4 shadow-2xl">
      <div className="grid h-16 w-16 mx-auto place-items-center rounded-full bg-blue-500/15 text-blue-200">
        <Sparkles size={28} className="animate-pulse" />
      </div>
      <div>
        <p className="text-lg font-semibold text-white">No rooms yet</p>
        <p className="text-sm text-white/55 mt-1.5 max-w-md mx-auto">
          A room is a live workspace where you talk through a product idea and
          the agent builds it in real time.
        </p>
      </div>
      <Link
        href="/rooms/new"
        className="inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-blue-500/25 text-blue-50 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500/35 transition-colors"
      >
        <Plus size={16} strokeWidth={2.4} />
        Create your first room
      </Link>
    </div>
  );
}

function RoomCard({
  roomId,
  title,
  templateId,
  objectiveLabel,
  createdAt,
  status,
}: {
  roomId: string;
  title: string;
  templateId: string | null;
  objectiveLabel: string | null;
  createdAt: Date;
  status: string;
}) {
  const template = getTemplate(templateId);
  const Icon = template?.icon ?? Layers3;
  const kindLabel = template?.artifactKind ?? objectiveLabel;
  return (
    <li className="group relative rounded-2xl border border-white/8 bg-slate-900/50 backdrop-blur-xl hover:border-white/20 hover:bg-slate-900/80 transition-all">
      <Link href={`/rooms/${roomId}`} className="block px-5 py-4">
        <div className="flex items-center justify-between gap-4 pr-16">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] border border-white/8 text-white/70">
              <Icon size={18} strokeWidth={1.8} />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="font-semibold truncate text-base">{title}</div>
              <div className="text-xs text-white/45 flex items-center gap-2">
                {kindLabel && (
                  <>
                    <span className="capitalize">{kindLabel}</span>
                    <span className="text-white/20">·</span>
                  </>
                )}
                <span>{formatDate(createdAt)}</span>
              </div>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
      </Link>
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <DeleteRoomButton roomId={roomId} roomTitle={title} />
      </div>
    </li>
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
    provisioning: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
    active: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
    archived: 'bg-white/10 text-white/55 border-white/15',
    error: 'bg-red-500/15 text-red-200 border-red-400/30',
  };
  const dotColors: Record<string, string> = {
    provisioning: 'bg-amber-400 animate-pulse',
    active: 'bg-emerald-400',
    archived: 'bg-white/40',
    error: 'bg-red-400',
  };
  return (
    <span
      className={`text-[11px] font-medium px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${
        colors[status] ?? colors.archived
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColors[status] ?? dotColors.archived}`} />
      {status}
    </span>
  );
}
