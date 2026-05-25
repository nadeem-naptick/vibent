import { NextResponse } from 'next/server';
import { and, desc, eq, lt } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms, versions } from '@/lib/db/schema';
import { snapshotStore } from '@/lib/snapshots/store';

type FileDiff = {
  path: string;
  kind: 'added' | 'removed' | 'modified' | 'unchanged';
  prevBytes?: number;
  nextBytes?: number;
};

// Compare a version against the previous one (by versionNumber). Returns
// per-file kind so the UI can render added / removed / modified.
export async function GET(
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

  const [target] = await db
    .select()
    .from(versions)
    .where(eq(versions.id, versionId))
    .limit(1);
  if (!target || target.roomId !== id) {
    return NextResponse.json({ error: 'version not found' }, { status: 404 });
  }

  // The "previous" version is the next-lowest versionNumber for this room.
  const [prev] = await db
    .select()
    .from(versions)
    .where(
      and(
        eq(versions.roomId, id),
        lt(versions.versionNumber, target.versionNumber),
      ),
    )
    .orderBy(desc(versions.versionNumber))
    .limit(1);

  const targetSnap = await snapshotStore().load(target.snapshotPath);
  const prevSnap = prev
    ? await snapshotStore().load(prev.snapshotPath).catch(() => null)
    : null;

  const targetMap = new Map(targetSnap.files.map((f) => [f.path, f.content]));
  const prevMap = new Map((prevSnap?.files ?? []).map((f) => [f.path, f.content]));

  const diffs: FileDiff[] = [];

  for (const [path, content] of targetMap) {
    const prevContent = prevMap.get(path);
    if (prevContent === undefined) {
      diffs.push({
        path,
        kind: 'added',
        nextBytes: Buffer.byteLength(content, 'utf8'),
      });
    } else if (prevContent !== content) {
      diffs.push({
        path,
        kind: 'modified',
        prevBytes: Buffer.byteLength(prevContent, 'utf8'),
        nextBytes: Buffer.byteLength(content, 'utf8'),
      });
    }
  }
  for (const [path, content] of prevMap) {
    if (!targetMap.has(path)) {
      diffs.push({
        path,
        kind: 'removed',
        prevBytes: Buffer.byteLength(content, 'utf8'),
      });
    }
  }

  // Sort: modified, added, removed, then alphabetical within each
  const kindOrder: Record<FileDiff['kind'], number> = {
    modified: 0,
    added: 1,
    removed: 2,
    unchanged: 3,
  };
  diffs.sort(
    (a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.path.localeCompare(b.path),
  );

  return NextResponse.json({
    versionNumber: target.versionNumber,
    prevVersionNumber: prev?.versionNumber ?? null,
    diffs,
  });
}
