import { SandboxFactory } from '@/lib/sandbox/factory';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

export type ProvisionedSandbox = {
  sandboxId: string;
  url: string;
};

/**
 * Provision a fresh sandbox + Vite React template for one Room.
 * Caller is responsible for persisting the returned identifiers on
 * the room record so the Live Room page can render the preview.
 */
export async function provisionRoomSandbox(): Promise<ProvisionedSandbox> {
  const provider = SandboxFactory.create();
  const info = await provider.createSandbox();
  await provider.setupViteApp();
  sandboxManager.registerSandbox(info.sandboxId, provider);
  return { sandboxId: info.sandboxId, url: info.url };
}
