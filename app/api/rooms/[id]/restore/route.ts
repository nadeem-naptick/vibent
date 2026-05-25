import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms } from '@/lib/db/schema';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { reattachSandbox } from '@/lib/sandbox/reattach';
import { getLatestVersion } from '@/lib/snapshots/manager';
import { restoreRoomSandbox } from '@/lib/sandbox/room-sandbox';

// Actually probe the sandbox URL. provider.isAlive() just checks whether
// there's an SDK handle in memory — it can return true for sandboxes whose
// underlying VM (or Vite server) is long dead, in which case the iframe
// shows E2B's "Sandbox Not Found" page even though we claimed active.
async function isUrlAlive(url: string, timeoutMs = 5000): Promise<boolean> {
  if (!url) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      // Don't follow into auth redirects or hold connections open.
      redirect: 'manual',
      headers: { 'user-agent': 'agentic-room-liveness-probe' },
    });
    clearTimeout(t);
    // E2B's not-found page returns 502 with an HTML body. Any 2xx/3xx
    // counts as alive (Vite usually returns 200 with the index).
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

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

  // Already up — short-circuit IF the URL is actually serving traffic.
  // We don't trust provider.isAlive() alone because it only checks whether
  // an SDK handle exists, not whether the sandbox VM / Vite server is up.
  if (room.sandboxId && room.sandboxUrl) {
    const hasHandle = !!sandboxManager.getProvider(room.sandboxId)?.isAlive();
    if (hasHandle) {
      const urlAlive = await isUrlAlive(room.sandboxUrl);
      if (urlAlive) {
        return NextResponse.json({ ok: true, status: 'active' });
      }
      console.log(
        `[restore] in-memory handle exists for ${room.sandboxId} but URL ${room.sandboxUrl} is DEAD — discarding stale handle`,
      );
      // Drop the stale handle so any future getProvider() calls miss and
      // force a fresh path through restore/recreate.
      await sandboxManager
        .terminateSandbox(room.sandboxId)
        .catch(() => {});
    }

    // No live in-memory handle — try reattaching to the (maybe still alive)
    // sandbox at E2B before doing a slow, expensive full snapshot restore.
    console.log(`[restore] attempting reattach for ${room.sandboxId}`);
    const reattached = await reattachSandbox(room.sandboxId, room.sandboxUrl);
    if (reattached) {
      // Verify the reattached sandbox URL is actually serving traffic.
      // Sandbox.connect() can return a handle whose underlying VM is dead.
      const urlAlive = await isUrlAlive(room.sandboxUrl);
      if (urlAlive) {
        console.log(`[restore] reattach + URL probe OK for ${room.sandboxId}`);
        if (room.status !== 'active') {
          await db
            .update(rooms)
            .set({ status: 'active', updatedAt: new Date() })
            .where(eq(rooms.id, id));
        }
        return NextResponse.json({ ok: true, status: 'active', reattached: true });
      }
      console.log(
        `[restore] reattach handle ok but URL ${room.sandboxUrl} is DEAD — falling back to snapshot restore`,
      );
      await sandboxManager
        .terminateSandbox(room.sandboxId)
        .catch(() => {});
    } else {
      console.log(`[restore] reattach failed for ${room.sandboxId} — falling back to snapshot restore`);
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
  const startedAt = Date.now();
  console.log(`[restore] starting for room ${id} from version v${latest.versionNumber}`);

  // 90-second hard timeout — if the sandbox provider hangs (stale token,
  // network issue) we want the user to see an actionable error state
  // rather than the spinner forever.
  const TIMEOUT_MS = 90_000;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () =>
        reject(
          new Error(
            `restore timed out after ${TIMEOUT_MS / 1000}s — sandbox provider likely down or token expired`,
          ),
        ),
      TIMEOUT_MS,
    );
  });

  Promise.race([restoreRoomSandbox(id, latest), timeoutPromise])
    .then(async (fresh) => {
      console.log(
        `[restore] complete for room ${id} in ${Date.now() - startedAt}ms — ${fresh.sandboxId}`,
      );

      // The sandbox provider returns as soon as Vite says it's "ready", but
      // Vite serves the index HTML before it's actually compiled the entry
      // module. If we flip to 'active' too early the user sees a white
      // screen for a few seconds. Wait until the URL serves a real page.
      const readyDeadline = Date.now() + 25_000;
      let lastFailReason = '';
      while (Date.now() < readyDeadline) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 4000);
          const res = await fetch(fresh.url, {
            signal: ctrl.signal,
            headers: { 'user-agent': 'agentic-room-postrestore-probe' },
          });
          clearTimeout(t);
          if (res.status >= 200 && res.status < 400) {
            const body = await res.text();
            const looksLikeIndex = /<div\s+id=["']root["']/.test(body);
            const hasError = /vite-error-overlay|Internal server error/i.test(body);
            // Verify the entry module also transforms (this is what catches
            // "Vite started but main.tsx has an error from snapshot" cases).
            const entryMatch = body.match(/src=["'](\/[^"']*main\.(?:tsx|jsx|ts|js))["']/);
            let entryOk = true;
            if (entryMatch?.[1]) {
              try {
                const ctrl2 = new AbortController();
                const t2 = setTimeout(() => ctrl2.abort(), 4000);
                const er = await fetch(`${fresh.url}${entryMatch[1]}`, {
                  signal: ctrl2.signal,
                });
                clearTimeout(t2);
                entryOk = er.status >= 200 && er.status < 400;
                if (!entryOk) lastFailReason = `entry module HTTP ${er.status}`;
              } catch (mErr) {
                entryOk = false;
                lastFailReason = `entry module fetch error: ${(mErr as Error).message}`;
              }
            }
            if (looksLikeIndex && !hasError && entryOk) {
              console.log(`[restore] post-restore probe OK for room ${id}`);
              break;
            }
            lastFailReason = lastFailReason || (hasError ? 'vite error overlay' : 'no root element');
          } else {
            lastFailReason = `HTTP ${res.status}`;
          }
        } catch (pErr) {
          lastFailReason = `fetch error: ${(pErr as Error).message}`;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (Date.now() >= readyDeadline) {
        console.warn(
          `[restore] post-restore readiness probe timed out for room ${id} (last reason: ${lastFailReason}). Flipping to active anyway — user may need to refresh.`,
        );
      }

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
      console.error(`[restore] FAILED for room ${id}:`, err?.message ?? err);
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
