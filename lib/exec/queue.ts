import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { runTask } from './run-task';

// In-process lock keyed by roomId — prevents two tasks for the same room
// from running concurrently. Cross-process queueing would need Redis; for
// our single-Next.js-process deployment this is sufficient.
const running = new Map<string, Promise<void>>();

/**
 * Look at queued tasks for a room and start the oldest one IF no other task
 * is currently running for that room. Recurses on completion to drain the
 * queue. Safe to call repeatedly — extra calls become no-ops.
 */
export function dispatchQueuedTasksForRoom(roomId: string): void {
  if (running.has(roomId)) return;
  const promise = (async () => {
    try {
      // Loop until no more queued tasks for this room
      while (true) {
        const [next] = await db
          .select()
          .from(tasks)
          .where(and(eq(tasks.roomId, roomId), eq(tasks.status, 'queued')))
          .orderBy(asc(tasks.createdAt))
          .limit(1);
        if (!next) break;
        try {
          await runTask(next.id);
        } catch (err) {
          // runTask already records errors on the task row — log and continue
          // so a single bad task doesn't wedge the queue.
          console.error('[queue] runTask threw for', next.id, err);
        }
      }
    } finally {
      running.delete(roomId);
    }
  })();
  running.set(roomId, promise);
}

/**
 * Helper to recover queued tasks after a server restart. Call on app boot
 * to drain anything that was left in 'queued' (or 'running' — those were
 * almost certainly interrupted and won't ever finish on their own).
 */
export async function recoverQueuesAtBoot(): Promise<void> {
  // Mark any tasks that say 'running' but weren't completed as failed; their
  // process is gone.
  await db
    .update(tasks)
    .set({
      status: 'failed',
      error: 'interrupted by server restart',
      completedAt: new Date(),
    })
    .where(eq(tasks.status, 'running'));

  // Find rooms with queued tasks and kick each off.
  const rows = await db
    .select({ roomId: tasks.roomId })
    .from(tasks)
    .where(inArray(tasks.status, ['queued'] as const));
  const uniqueRooms = Array.from(new Set(rows.map((r) => r.roomId)));
  for (const roomId of uniqueRooms) {
    dispatchQueuedTasksForRoom(roomId);
  }
}
