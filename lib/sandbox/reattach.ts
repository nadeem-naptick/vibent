import { SandboxFactory } from './factory';
import { sandboxManager } from './sandbox-manager';
import { VercelProvider } from './providers/vercel-provider';
import { E2BProvider } from './providers/e2b-provider';
import type { SandboxProvider } from './types';

/**
 * Reattach to an existing sandbox by its ID. The in-memory sandboxManager
 * loses all registrations on Next.js dev HMR / server restart, but the
 * sandbox itself usually keeps running at Vercel / E2B.
 *
 * Returns the provider on success, null if reattach genuinely fails (the
 * sandbox has actually expired / been killed) — caller should then fall
 * back to restoring from a snapshot.
 */
export async function reattachSandbox(
  sandboxId: string,
  url: string,
): Promise<SandboxProvider | null> {
  const provider = SandboxFactory.create();
  try {
    if (provider instanceof VercelProvider) {
      await provider.attachToSandbox(sandboxId, url);
    } else if (provider instanceof E2BProvider) {
      await provider.attachToSandbox(sandboxId, url);
    } else {
      console.warn(`[reattach] unknown provider type for sandbox ${sandboxId}`);
      return null;
    }
    sandboxManager.registerSandbox(sandboxId, provider);
    return provider;
  } catch (err) {
    console.warn(`[reattach] failed for sandbox ${sandboxId}:`, err);
    return null;
  }
}
