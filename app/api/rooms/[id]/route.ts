import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms } from '@/lib/db/schema';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { getIntentsCollection, getTranscriptsCollection } from '@/lib/db/mongo';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  if (!room) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    id: room.id,
    title: room.title,
    status: room.status,
    sandboxUrl: room.sandboxUrl,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  if (!room) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (room.hostUserId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Terminate sandbox if one was provisioned. Best-effort — don't block the
  // delete if the sandbox is already gone.
  if (room.sandboxId) {
    sandboxManager.terminateSandbox(room.sandboxId).catch((err) => {
      console.warn('[rooms] sandbox terminate failed:', err);
    });
  }

  // Cascade-delete Mongo transcripts + intents for this room. Postgres
  // cascades participants via the FK.
  try {
    const [transcripts, intents] = await Promise.all([
      getTranscriptsCollection(),
      getIntentsCollection(),
    ]);
    await Promise.all([
      transcripts.deleteMany({ roomId: id }),
      intents.deleteMany({ roomId: id }),
    ]);
  } catch (err) {
    console.warn('[rooms] mongo cleanup failed:', err);
  }

  await db.delete(rooms).where(eq(rooms.id, id));
  return NextResponse.json({ ok: true });
}
