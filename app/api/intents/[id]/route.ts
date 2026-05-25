import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getIntentsCollection, type DetectedIntent } from '@/lib/db/mongo';
import { db } from '@/lib/db';
import { rooms } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Update an intent's status (Apply / Ignore / etc.) — host-only.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const allowedStatuses: DetectedIntent['status'][] = [
    'pending_approval',
    'approved',
    'ignored',
    'applied',
    'noted',
  ];
  if (!body?.status || !allowedStatuses.includes(body.status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }

  const intents = await getIntentsCollection();
  const intent = await intents.findOne({ id });
  if (!intent) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Only the room host can act on intents in M2. M3+ will support delegated
  // approval to specific collaborators.
  const [room] = await db.select().from(rooms).where(eq(rooms.id, intent.roomId)).limit(1);
  if (!room || room.hostUserId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await intents.updateOne(
    { id },
    {
      $set: {
        status: body.status,
        resolvedAt: new Date(),
        resolvedBy: session.user.id,
      },
    },
  );
  const updated = await intents.findOne({ id });
  return NextResponse.json(updated);
}
