import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms } from '@/lib/db/schema';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { createVersion, getVersion } from '@/lib/snapshots/manager';
import { snapshotStore } from '@/lib/snapshots/store';
import { restoreProject } from '@/lib/snapshots/snapshot';

// Rollback to a specific version. Host-only. The current sandbox is rewound
// to that version's snapshot; we then create a NEW version entry tagged with
// rolledBackFromVersionId so the timeline preserves history.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id, versionId } = await params;

  const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  if (!room) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (room.hostUserId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const target = await getVersion(versionId);
  if (!target || target.roomId !== id) {
    return NextResponse.json({ error: 'version not found' }, { status: 404 });
  }

  if (!room.sandboxId) {
    return NextResponse.json({ error: 'room has no sandbox' }, { status: 409 });
  }
  const sandbox = sandboxManager.getProvider(room.sandboxId);
  if (!sandbox) {
    return NextResponse.json(
      { error: 'sandbox not registered with this server (try refreshing the room to auto-restore first)' },
      { status: 409 },
    );
  }

  try {
    const snapshot = await snapshotStore().load(target.snapshotPath);
    await restoreProject(sandbox, snapshot);
  } catch (err) {
    console.error('[rollback] restore failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'restore failed' },
      { status: 500 },
    );
  }

  // Snapshot the new state so the timeline preserves the rollback action
  // (otherwise a rollback would silently rewrite history).
  let newVersion;
  try {
    newVersion = await createVersion({
      roomId: id,
      sandbox,
      summary: `Rolled back to v${target.versionNumber}: ${target.summary}`,
      rolledBackFromVersionId: target.id,
    });
  } catch (err) {
    console.warn('[rollback] post-rollback snapshot failed:', err);
  }

  return NextResponse.json({
    ok: true,
    rolledBackTo: { id: target.id, versionNumber: target.versionNumber },
    newVersion,
  });
}
