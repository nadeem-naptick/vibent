import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms, participants } from '@/lib/db/schema';
import { mintLiveKitToken, publicLiveKitUrl } from '@/lib/livekit';
import { OBJECTIVE_LABELS } from '@/lib/templates';
import {
  ensureIndexes,
  getIntentsCollection,
  getTranscriptsCollection,
} from '@/lib/db/mongo';
import { LiveRoomClient } from './LiveRoomClient';
import { SignOutButton } from '@/components/auth/SignOutButton';
import type { RoomFeed } from './types';

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const { id } = await params;
  const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  if (!room) notFound();

  // Ensure user has a participant row in this room
  const [existingParticipant] = await db
    .select()
    .from(participants)
    .where(
      and(
        eq(participants.roomId, room.id),
        eq(participants.userId, session.user.id),
      ),
    )
    .limit(1);

  let participant = existingParticipant;
  if (!participant) {
    const [created] = await db
      .insert(participants)
      .values({
        roomId: room.id,
        userId: session.user.id,
        displayName: session.user.name ?? 'Collaborator',
        role: 'collaborator',
        livekitIdentity: session.user.id,
      })
      .returning();
    participant = created;
  }

  const token = await mintLiveKitToken({
    roomId: room.id,
    identity: participant.livekitIdentity,
    name: participant.displayName,
    role: participant.role as 'host' | 'collaborator' | 'viewer',
  });

  // Load existing transcripts + intents so the AI panel renders on first paint
  // for late joiners, not just future utterances.
  await ensureIndexes();
  const [transcriptDocs, intentDocs] = await Promise.all([
    getTranscriptsCollection().then((c) =>
      c.find({ roomId: room.id }).sort({ createdAt: 1 }).limit(200).toArray(),
    ),
    getIntentsCollection().then((c) =>
      c.find({ roomId: room.id }).sort({ createdAt: -1 }).limit(100).toArray(),
    ),
  ]);
  const initialFeed: RoomFeed = {
    transcripts: JSON.parse(JSON.stringify(transcriptDocs)),
    intents: JSON.parse(JSON.stringify(intentDocs)),
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="border-b border-neutral-900 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href="/dashboard"
            className="text-sm text-neutral-500 hover:text-neutral-300"
          >
            ← Dashboard
          </Link>
          <div className="min-w-0">
            <div className="font-medium truncate">{room.title}</div>
            <div className="text-xs text-neutral-500">
              {OBJECTIVE_LABELS[room.objective]} ·{' '}
              <RoomStatus status={room.status} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-neutral-500">
            {participant.role} · {participant.displayName}
          </span>
          <SignOutButton />
        </div>
      </header>

      <LiveRoomClient
        roomId={room.id}
        token={token}
        serverUrl={publicLiveKitUrl}
        sandboxUrl={room.sandboxUrl}
        status={room.status}
        isHost={participant.role === 'host'}
        speakerName={participant.displayName}
        initialFeed={initialFeed}
      />
    </main>
  );
}

function RoomStatus({ status }: { status: string }) {
  const colors: Record<string, string> = {
    provisioning: 'text-amber-400',
    active: 'text-emerald-400',
    archived: 'text-neutral-500',
    error: 'text-red-400',
  };
  return <span className={colors[status] ?? colors.archived}>{status}</span>;
}
