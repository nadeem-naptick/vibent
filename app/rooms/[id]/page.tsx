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
import { tasks } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { getLatestVersion, listVersions } from '@/lib/snapshots/manager';
import { LiveRoomClient } from './LiveRoomClient';
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

  // Detect a dead sandbox WITHOUT blocking the page render. If the sandbox
  // is gone (server restart or expired) we flip the room status to
  // 'provisioning' synchronously and let the LiveRoomClient kick off the
  // actual restore via POST /api/rooms/[id]/restore on mount. The iframe
  // area shows "Provisioning workspace…" until the polling sees the room
  // flip back to 'active' with a fresh sandboxUrl.
  let liveRoom = room;
  if (room.status === 'active' && room.sandboxId) {
    const alive = sandboxManager.getProvider(room.sandboxId)?.isAlive();
    if (!alive) {
      const latest = await getLatestVersion(room.id);
      if (latest) {
        const [updated] = await db
          .update(rooms)
          .set({
            status: 'provisioning',
            sandboxUrl: null,
            updatedAt: new Date(),
          })
          .where(eq(rooms.id, room.id))
          .returning();
        liveRoom = updated;
      }
    }
  }

  const token = await mintLiveKitToken({
    roomId: liveRoom.id,
    identity: participant.livekitIdentity,
    name: participant.displayName,
    role: participant.role as 'host' | 'collaborator' | 'viewer',
  });

  // Load existing transcripts + intents + tasks so the AI panel renders on
  // first paint for late joiners.
  await ensureIndexes();
  const [transcriptDocs, intentDocs, taskRows, versionRows] = await Promise.all([
    getTranscriptsCollection().then((c) =>
      c.find({ roomId: liveRoom.id }).sort({ createdAt: 1 }).limit(200).toArray(),
    ),
    getIntentsCollection().then((c) =>
      c.find({ roomId: liveRoom.id }).sort({ createdAt: -1 }).limit(100).toArray(),
    ),
    db
      .select()
      .from(tasks)
      .where(eq(tasks.roomId, liveRoom.id))
      .orderBy(desc(tasks.createdAt))
      .limit(20),
    listVersions(liveRoom.id),
  ]);
  const initialFeed: RoomFeed = {
    transcripts: JSON.parse(JSON.stringify(transcriptDocs)),
    intents: JSON.parse(JSON.stringify(intentDocs)),
    tasks: JSON.parse(JSON.stringify(taskRows)),
    versions: JSON.parse(JSON.stringify(versionRows)),
  };

  return (
    <LiveRoomClient
      roomId={liveRoom.id}
      token={token}
      serverUrl={publicLiveKitUrl}
      sandboxUrl={liveRoom.sandboxUrl}
      status={liveRoom.status}
      isHost={participant.role === 'host'}
      speakerName={participant.displayName}
      initialFeed={initialFeed}
      room={{
        title: liveRoom.title,
        objective: liveRoom.objective,
        outputType: liveRoom.outputType,
        context: liveRoom.context,
      }}
    />
  );
}
