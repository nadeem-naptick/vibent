import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms } from '@/lib/db/schema';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { getLatestVersion } from '@/lib/snapshots/manager';
import { restoreRoomSandbox } from '@/lib/sandbox/room-sandbox';

// In-process lock so concurrent restore requests for the same room don't
// each spin up a new sandbox.
const restoring = new Set<string>();

// Fire-and-forget restore of a dead sandbox from the latest version snapshot.
// Returns 202 immediately so the page can render and poll for completion.
// Idempotent: calling again while a restore is in progress is a no-op.
export async function POST(
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

  // Already up — short-circuit.
  if (room.sandboxId) {
    const alive = sandboxManager.getProvider(room.sandboxId)?.isAlive();
    if (alive) {
      return NextResponse.json({ ok: true, status: 'active' });
    }
  }

  if (restoring.has(id)) {
    return NextResponse.json({ ok: true, status: 'restoring' }, { status: 202 });
  }

  const latest = await getLatestVersion(id);
  if (!latest) {
    return NextResponse.json(
      { error: 'no snapshot to restore from — room must be recreated' },
      { status: 409 },
    );
  }

  // Mark as provisioning so the polling UI knows what to show.
  await db
    .update(rooms)
    .set({ status: 'provisioning', updatedAt: new Date() })
    .where(eq(rooms.id, id));

  restoring.add(id);
  restoreRoomSandbox(id, latest)
    .then(async (fresh) => {
      await db
        .update(rooms)
        .set({
          sandboxId: fresh.sandboxId,
          sandboxUrl: fresh.url,
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(rooms.id, id));
    })
    .catch(async (err) => {
      console.error('[restore] failed for room', id, err);
      await db
        .update(rooms)
        .set({ status: 'error', updatedAt: new Date() })
        .where(eq(rooms.id, id))
        .catch(() => {});
    })
    .finally(() => {
      restoring.delete(id);
    });

  return NextResponse.json({ ok: true, status: 'restoring' }, { status: 202 });
}
