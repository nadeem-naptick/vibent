import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms, participants, type RoomContext } from '@/lib/db/schema';
import { getTemplate } from '@/lib/templates';
import { provisionRoomSandbox } from '@/lib/sandbox/room-sandbox';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const {
    title,
    objective,
    outputType,
    templateId,
    context,
  } = body as {
    title?: string;
    objective?: string;
    outputType?: string;
    templateId?: string;
    context?: RoomContext;
  };

  if (!title || !objective || !outputType) {
    return NextResponse.json(
      { error: 'title, objective, outputType are required' },
      { status: 400 },
    );
  }

  // Validate template if provided
  const template = templateId ? getTemplate(templateId) : undefined;

  // 1. Insert room as provisioning
  const [room] = await db
    .insert(rooms)
    .values({
      title,
      objective: objective as never,
      outputType: outputType as never,
      templateId: template?.id ?? null,
      hostUserId: session.user.id,
      context: context ?? {},
      status: 'provisioning',
    })
    .returning();

  // 2. Insert host participant
  await db.insert(participants).values({
    roomId: room.id,
    userId: session.user.id,
    displayName: session.user.name ?? 'Host',
    role: 'host',
    livekitIdentity: session.user.id,
  });

  // 3. Spin up sandbox in the background — don't block the response.
  // The Live Room page polls the room until status === 'active'.
  provisionRoomSandbox()
    .then(async ({ sandboxId, url }) => {
      await db
        .update(rooms)
        .set({
          sandboxId,
          sandboxUrl: url,
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(rooms.id, room.id));
    })
    .catch(async (err) => {
      console.error('[rooms] sandbox provision failed:', err);
      await db
        .update(rooms)
        .set({ status: 'error', updatedAt: new Date() })
        .where(eq(rooms.id, room.id));
    });

  return NextResponse.json({ id: room.id }, { status: 201 });
}
