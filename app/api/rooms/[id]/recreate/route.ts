import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms } from '@/lib/db/schema';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { provisionRoomSandbox } from '@/lib/sandbox/room-sandbox';

// Last-resort recovery: wipe the sandbox state and provision a fresh one.
// Unlike /restore which uses the latest version snapshot, this builds from
// the Vite template fresh. Use when restore is repeatedly failing (stale
// provider token, sandbox stuck, etc).
//
// Note: this LOSES the work captured in newer versions; user should rollback
// in the Versions drawer first if they want to keep state.
const recreating = new Set<string>();

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
  if (!room) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (room.hostUserId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (recreating.has(id)) {
    return NextResponse.json({ ok: true, status: 'recreating' }, { status: 202 });
  }

  // Best-effort terminate the existing sandbox
  if (room.sandboxId) {
    sandboxManager.terminateSandbox(room.sandboxId).catch(() => {});
  }

  await db
    .update(rooms)
    .set({
      status: 'provisioning',
      sandboxUrl: null,
      sandboxId: null,
      updatedAt: new Date(),
    })
    .where(eq(rooms.id, id));

  recreating.add(id);

  // Fresh sandbox + Vite template, also re-snapshots v(n+1) as "Recreated".
  const TIMEOUT_MS = 90_000;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`recreate timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS),
  );
  Promise.race([provisionRoomSandbox(id), timeout])
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
      console.log('[recreate] success for room', id);
    })
    .catch(async (err) => {
      console.error('[recreate] failed for room', id, err);
      await db
        .update(rooms)
        .set({ status: 'error', updatedAt: new Date() })
        .where(eq(rooms.id, id))
        .catch(() => {});
    })
    .finally(() => {
      recreating.delete(id);
    });

  return NextResponse.json({ ok: true, status: 'recreating' }, { status: 202 });
}
