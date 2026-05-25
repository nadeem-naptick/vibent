import { and, asc, desc, eq, lt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { versions, type Version } from '@/lib/db/schema';
import type { SandboxProvider } from '@/lib/sandbox/types';
import { snapshotStore } from './store';
import { snapshotProject } from './snapshot';

// Keep at most this many versions per room — older ones get pruned (snapshot
// file deleted + DB row removed) when a new one is created.
const MAX_VERSIONS_PER_ROOM = 20;

type CreateVersionOpts = {
  roomId: string;
  sandbox: SandboxProvider;
  summary: string;
  taskId?: string | null;
  rolledBackFromVersionId?: string | null;
};

/**
 * Snapshot the sandbox project files NOW, persist to durable storage,
 * insert a Version row, and prune old versions for this room.
 *
 * Returns the created version. Throws if the snapshot/store fails — callers
 * should wrap with try/catch if they don't want to fail the parent flow.
 */
export async function createVersion(opts: CreateVersionOpts): Promise<Version> {
  const { roomId, sandbox, summary, taskId, rolledBackFromVersionId } = opts;

  // 1. Snapshot
  const snapshot = await snapshotProject(sandbox);

  // 2. Determine next version number (per-room sequential)
  const [latest] = await db
    .select({ versionNumber: versions.versionNumber })
    .from(versions)
    .where(eq(versions.roomId, roomId))
    .orderBy(desc(versions.versionNumber))
    .limit(1);
  const nextNumber = (latest?.versionNumber ?? -1) + 1;

  // 3. Persist snapshot bytes
  const versionId = nanoid();
  const snapshotPath = await snapshotStore().save(roomId, versionId, snapshot);

  // 4. Insert DB row
  const [row] = await db
    .insert(versions)
    .values({
      id: versionId,
      roomId,
      versionNumber: nextNumber,
      taskId: taskId ?? null,
      rolledBackFromVersionId: rolledBackFromVersionId ?? null,
      summary,
      snapshotPath,
      fileCount: snapshot.meta.fileCount,
      totalBytes: snapshot.meta.totalBytes,
    })
    .returning();

  // 5. Prune old versions (keep most recent MAX_VERSIONS_PER_ROOM)
  const stale = await db
    .select()
    .from(versions)
    .where(
      and(
        eq(versions.roomId, roomId),
        lt(versions.versionNumber, nextNumber - MAX_VERSIONS_PER_ROOM + 1),
      ),
    );
  for (const v of stale) {
    try {
      await snapshotStore().delete(v.snapshotPath);
    } catch (err) {
      console.warn('[versions] failed to delete snapshot', v.snapshotPath, err);
    }
    await db.delete(versions).where(eq(versions.id, v.id));
  }

  return row;
}

export async function listVersions(roomId: string): Promise<Version[]> {
  return db
    .select()
    .from(versions)
    .where(eq(versions.roomId, roomId))
    .orderBy(desc(versions.versionNumber));
}

export async function getLatestVersion(roomId: string): Promise<Version | null> {
  const [row] = await db
    .select()
    .from(versions)
    .where(eq(versions.roomId, roomId))
    .orderBy(desc(versions.versionNumber))
    .limit(1);
  return row ?? null;
}

export async function getVersion(versionId: string): Promise<Version | null> {
  const [row] = await db
    .select()
    .from(versions)
    .where(eq(versions.id, versionId))
    .limit(1);
  return row ?? null;
}
