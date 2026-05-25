import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';

// Polled by useRoomFeed every ~1s while any task in the room is running or
// queued. Returns the 20 most-recent tasks (newest first).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.roomId, id))
    .orderBy(desc(tasks.createdAt))
    .limit(20);

  return NextResponse.json({ tasks: rows });
}
