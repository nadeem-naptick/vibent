import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms, participants, users } from '@/lib/db/schema';
import { getTemplate } from '@/lib/templates';
import { provisionRoomSandbox } from '@/lib/sandbox/room-sandbox';
import { withDefaults } from '@/lib/user-preferences';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { title, templateId, instructions } = body as {
    title?: string;
    templateId?: string;
    instructions?: string;
  };

  if (!title || !templateId) {
    return NextResponse.json(
      { error: 'title and templateId are required' },
      { status: 400 },
    );
  }

  const template = getTemplate(templateId);
  if (!template) {
    return NextResponse.json({ error: 'unknown templateId' }, { status: 400 });
  }

  const trimmedInstructions = instructions?.trim() || null;

  // Read the host's defaults — captureState is seeded from their preference
  // so users who prefer "off the record" don't need to flip Vibe off on
  // every new room.
  const [hostRow] = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const hostPrefs = withDefaults(hostRow?.preferences);

  // 1. Insert room as provisioning
  const [room] = await db
    .insert(rooms)
    .values({
      title,
      templateId: template.id,
      instructions: trimmedInstructions,
      hostUserId: session.user.id,
      status: 'provisioning',
      captureState: hostPrefs.defaultCaptureState,
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
  // Captures v0 snapshot once the Vite template is up.
  provisionRoomSandbox(room.id)
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
