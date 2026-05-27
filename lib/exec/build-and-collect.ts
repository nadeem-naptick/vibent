import * as tar from 'tar-stream';
import mime from 'mime-types';
import type { SandboxProvider } from '@/lib/sandbox/types';

// Thrown when `vite build` exits non-zero. The message includes the tail of
// build output so callers can surface it back to the user.
export class BuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuildError';
  }
}

export type BuiltFile = {
  // Relative to dist root, e.g. 'index.html' or 'assets/index-abc.js'
  path: string;
  content: Buffer;
  contentType: string;
};

// Shared by export (ZIP) and share (S3 upload). Runs `vite build` in the
// live sandbox, tars the dist directory, base64s it out, untars in-process.
// Binary-safe — works for images, fonts, anything Vite outputs.
//
// `base` controls Vite's asset-path resolution:
//   - './' (default): all asset paths relative — works locally if you open
//     dist/index.html or at any sub-path on any host.
//   - '/shares/<slug>/': absolute paths under that prefix — required when
//     hosting at e.g. s3.amazonaws.com/bucket/shares/<slug>/.
//
// Caller is responsible for sandbox lifecycle and providing a working
// project directory (we assume Vite at /home/user/app, the E2B provider
// default).
export async function buildAndCollect(
  sandbox: SandboxProvider,
  options: { base?: string } = {},
): Promise<BuiltFile[]> {
  const base = options.base ?? './';

  // 1. Run vite build. `npm run build -- --base=...` forwards the flag past
  // npm to vite. The 2>&1 redirect captures stderr in stdout so we can show
  // it to the user on failure.
  const buildCmd = `cd /home/user/app && npm run build -- --base=${JSON.stringify(base)} 2>&1`;
  const buildRes = await sandbox.runCommand(buildCmd);
  if (buildRes.exitCode !== 0) {
    throw new BuildError(
      `vite build failed (exit ${buildRes.exitCode}):\n${(buildRes.stdout ?? '').slice(-2000)}`,
    );
  }

  // 2. Tar dist into a single stream + base64 — single runCommand round-trip,
  // binary-safe across the JSON stdout transport.
  const tarRes = await sandbox.runCommand(
    'cd /home/user/app/dist && tar -cf - . | base64 -w0',
  );
  if (tarRes.exitCode !== 0) {
    throw new BuildError(
      `tar dist failed (exit ${tarRes.exitCode}): ${(tarRes.stdout ?? '').slice(-500)}`,
    );
  }
  const tarBuffer = Buffer.from((tarRes.stdout ?? '').trim(), 'base64');
  if (tarBuffer.length === 0) {
    throw new BuildError('tar produced 0 bytes — dist/ is empty or unreadable');
  }

  // 3. Extract entries in-process.
  const files: BuiltFile[] = [];
  await new Promise<void>((resolve, reject) => {
    const extract = tar.extract();
    extract.on('entry', (header, stream, next) => {
      if (header.type !== 'file') {
        stream.resume();
        next();
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => {
        const relPath = header.name.replace(/^\.\//, '');
        files.push({
          path: relPath,
          content: Buffer.concat(chunks),
          contentType: (mime.lookup(relPath) || 'application/octet-stream') as string,
        });
        next();
      });
      stream.on('error', reject);
    });
    extract.on('finish', resolve);
    extract.on('error', reject);
    extract.end(tarBuffer);
  });

  if (files.length === 0) {
    throw new BuildError('built dist/ contained no files');
  }
  return files;
}
