import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms, tasks } from '@/lib/db/schema';
import { cancelRunningTask } from '@/lib/exec/run-task';

// Host-only. For queued tasks: marks them cancelled (queue dispatcher skips
// them). For running tasks: aborts the in-flight generateText call AND
// rolls back the sandbox to the latest pre-task version snapshot.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!task) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Permission: must be host of the room the task belongs to
  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, task.roomId))
    .limit(1);
  if (!room) {
    return NextResponse.json({ error: 'room not found' }, { status: 404 });
  }
  if (room.hostUserId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (task.status === 'queued') {
    await db
      .update(tasks)
      .set({
        status: 'cancelled',
        error: 'Cancelled by user before start',
        completedAt: new Date(),
      })
      .where(eq(tasks.id, id));
    return NextResponse.json({ ok: true, status: 'cancelled' });
  }

  if (task.status === 'running') {
    const ok = cancelRunningTask(id);
    if (!ok) {
      // Race: task already finished between the DB read and the abort call
      return NextResponse.json(
        { error: 'task already finished' },
        { status: 409 },
      );
    }
    // The runTask catch block will set status='cancelled' + run rollback
    return NextResponse.json({ ok: true, status: 'aborting' });
  }

  return NextResponse.json(
    { error: `cannot cancel a ${task.status} task` },
    { status: 409 },
  );
}
