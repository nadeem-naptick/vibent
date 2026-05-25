import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms, tasks } from '@/lib/db/schema';
import { getIntentsCollection } from '@/lib/db/mongo';
import { dispatchQueuedTasksForRoom } from '@/lib/exec/queue';

// Host-driven decision composition: bundle N selected detections into one
// editable instruction and queue it as a Task. Marks source intents as
// 'applied' so they no longer appear in Detected.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const roomId = body?.roomId ? String(body.roomId) : null;
  const intentIds: string[] = Array.isArray(body?.intentIds) ? body.intentIds : [];
  const instruction = body?.instruction ? String(body.instruction).trim() : null;
  // Caller (client) sends the current thinking-mode preference at submit
  // time. Default to true (thinking on) if not provided — preserves the
  // historical behavior before the toggle existed.
  const thinkingMode = body?.thinkingMode === undefined ? true : Boolean(body.thinkingMode);

  if (!roomId || !instruction || instruction.length < 5) {
    return NextResponse.json(
      { error: 'roomId and instruction (≥5 chars) required' },
      { status: 400 },
    );
  }

  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (room.hostUserId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Insert task with the full set of source intents.
  const [task] = await db
    .insert(tasks)
    .values({
      roomId,
      instruction,
      sourceIntentIds: intentIds,
      status: 'queued',
      thinkingMode: thinkingMode ? 1 : 0,
    })
    .returning();

  // Mark source intents as applied so they drop out of the Detected feed.
  if (intentIds.length > 0) {
    const intents = await getIntentsCollection();
    await intents.updateMany(
      { roomId, id: { $in: intentIds } },
      {
        $set: {
          status: 'applied',
          resolvedAt: new Date(),
          resolvedBy: session.user.id,
        },
      },
    );
  }

  // Kick the queue — runs FIFO, one task per room at a time.
  dispatchQueuedTasksForRoom(roomId);

  return NextResponse.json({ taskId: task.id }, { status: 201 });
}
