import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms } from '@/lib/db/schema';

// GET /api/rooms/[id]/capture
// Returns the room's current capture state. Used by clients to recover from
// a missed data-channel broadcast (tab backgrounded, network blip, etc.).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const [room] = await db
    .select({ captureState: rooms.captureState })
    .from(rooms)
    .where(eq(rooms.id, id))
    .limit(1);
  if (!room) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ state: room.captureState });
}

// POST /api/rooms/[id]/capture
// Host-only toggle for the mic→AI pipeline. Body: { state: 'listening' | 'paused' }.
// Does NOT affect in-flight tasks, pending decisions, or LiveKit audio between
// participants — only governs whether the browser opens its Deepgram WS.
// Clients broadcast the change over LiveKit's data channel after the API call
// returns so other participants update instantly.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { state?: 'listening' | 'paused' }
    | null;
  const state = body?.state;
  if (state !== 'listening' && state !== 'paused') {
    return NextResponse.json({ error: 'invalid state' }, { status: 400 });
  }

  const { id } = await params;
  const [room] = await db
    .select({ hostUserId: rooms.hostUserId })
    .from(rooms)
    .where(eq(rooms.id, id))
    .limit(1);
  if (!room) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (room.hostUserId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await db
    .update(rooms)
    .set({ captureState: state, updatedAt: new Date() })
    .where(eq(rooms.id, id));

  return NextResponse.json({ ok: true, state });
}
