import { SandboxFactory } from '@/lib/sandbox/factory';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { createVersion } from '@/lib/snapshots/manager';
import { restoreProject } from '@/lib/snapshots/snapshot';
import { snapshotStore } from '@/lib/snapshots/store';
import type { Version } from '@/lib/db/schema';

export type ProvisionedSandbox = {
  sandboxId: string;
  url: string;
};

/**
 * Provision a fresh sandbox + Vite React template for one Room. Captures
 * the initial template as version 0 so we have something to roll back to
 * even before any tasks run.
 */
export async function provisionRoomSandbox(roomId?: string): Promise<ProvisionedSandbox> {
  const provider = SandboxFactory.create();
  const info = await provider.createSandbox();
  await provider.setupViteApp();
  sandboxManager.registerSandbox(info.sandboxId, provider);

  // Best-effort initial snapshot. Failures here don't block room creation —
  // the room is still usable, just won't have a rollback target until first
  // task completes.
  if (roomId) {
    try {
      await createVersion({
        roomId,
        sandbox: provider,
        summary: 'Initial Vite + React template',
      });
    } catch (err) {
      console.warn('[room-sandbox] initial snapshot failed:', err);
    }
  }

  return { sandboxId: info.sandboxId, url: info.url };
}

/**
 * Recreate a sandbox for a room whose previous one expired or was lost
 * (e.g. server restart). Restores files from the latest version snapshot.
 */
export async function restoreRoomSandbox(
  roomId: string,
  version: Version,
): Promise<ProvisionedSandbox> {
  const provider = SandboxFactory.create();
  const info = await provider.createSandbox();
  await provider.setupViteApp();

  // Overwrite the template files with whatever the latest snapshot has.
  const snapshot = await snapshotStore().load(version.snapshotPath);
  await restoreProject(provider, snapshot);

  sandboxManager.registerSandbox(info.sandboxId, provider);

  return { sandboxId: info.sandboxId, url: info.url };
}
