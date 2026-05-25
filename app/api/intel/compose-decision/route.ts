import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms } from '@/lib/db/schema';
import { getIntentsCollection } from '@/lib/db/mongo';
import { composeDecision } from '@/lib/intel/classify';

// Take a set of detection (intent) IDs the host selected, pull the originals
// from Mongo, and ask the intel model to merge them into a single instruction
// the host can edit and then submit as a Task.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const roomId = body?.roomId ? String(body.roomId) : null;
  const intentIds: string[] = Array.isArray(body?.intentIds) ? body.intentIds : [];
  if (!roomId || intentIds.length === 0) {
    return NextResponse.json(
      { error: 'roomId and at least one intentId required' },
      { status: 400 },
    );
  }

  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (room.hostUserId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const intents = await getIntentsCollection();
  const docs = await intents
    .find({ roomId, id: { $in: intentIds } })
    .toArray();
  if (docs.length === 0) {
    return NextResponse.json({ error: 'no matching intents' }, { status: 404 });
  }

  try {
    const instruction = await composeDecision({
      roomObjective: room.objective,
      detections: docs.map((d) => ({
        type: d.type,
        summary: d.summary,
        rawText: d.rawText,
        speakerName: d.speakerName,
      })),
    });
    return NextResponse.json({ instruction });
  } catch (err) {
    console.error('[compose-decision] failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'compose failed' },
      { status: 500 },
    );
  }
}
