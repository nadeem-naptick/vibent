import { tool } from 'ai';
import { z } from 'zod';
import type { SandboxProvider } from '@/lib/sandbox/types';

// Thrown by any tool when the underlying sandbox has gone away (expired,
// killed, OOM). run-task catches this specifically so it can mark the task
// as failed-with-recovery and auto-trigger a restore instead of returning
// the raw E2B error string to the user.
export class SandboxLostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxLostError';
  }
}

const LOST_PATTERNS = [
  /sandbox\s+.*\s+wasn['’]t\s+found/i,
  /sandbox\s+.*\s+not\s+found/i,
  /sandbox\s+has\s+been\s+killed/i,
  /sandbox\s+has\s+expired/i,
  /sandbox\s+is\s+terminated/i,
  /connection\s+to\s+sandbox\s+lost/i,
];

function isSandboxLostError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return LOST_PATTERNS.some((rx) => rx.test(msg));
}

function rethrowIfLost(err: unknown): never | void {
  if (isSandboxLostError(err)) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new SandboxLostError(msg);
  }
}

// Tools the execution agent uses to read/write/run things inside the room's
// per-room sandbox. Thin wrappers over SandboxProvider so the model sees a
// clean, intent-aligned surface area.
//
// All paths are project-root-relative. The sandbox provider already
// normalises to its working directory (/vercel/sandbox for Vercel).
export function createSandboxTools(sandbox: SandboxProvider, sandboxUrl: string) {
  return {
    list_files: tool({
      description:
        'List files in a directory of the project. Use this first to learn the project structure before reading or writing.',
      inputSchema: z.object({
        directory: z
          .string()
          .default('src')
          .describe('Directory relative to project root, e.g. "src" or "src/components"'),
      }),
      execute: async ({ directory }) => {
        try {
          const files = await sandbox.listFiles(directory);
          return { ok: true, files };
        } catch (err) {
          rethrowIfLost(err);
          return { ok: false, error: errMsg(err) };
        }
      },
    }),

    read_file: tool({
      description:
        'Read the full contents of a file. Use before editing so you preserve unrelated parts.',
      inputSchema: z.object({
        path: z.string().describe('Path relative to project root, e.g. "src/App.tsx"'),
      }),
      execute: async ({ path }) => {
        try {
          const content = await sandbox.readFile(path);
          return { ok: true, content };
        } catch (err) {
          rethrowIfLost(err);
          return { ok: false, error: errMsg(err) };
        }
      },
    }),

    write_file: tool({
      description:
        'Create a new file OR completely overwrite an existing one with the provided content. For small targeted edits to an existing file, prefer reading it first and then writing the full updated content.',
      inputSchema: z.object({
        path: z.string(),
        content: z.string(),
      }),
      execute: async ({ path, content }) => {
        try {
          await sandbox.writeFile(path, content);
          return { ok: true };
        } catch (err) {
          rethrowIfLost(err);
          return { ok: false, error: errMsg(err) };
        }
      },
    }),

    install_packages: tool({
      description:
        'Install one or more npm packages into the project. Use when the change you are making requires a new dependency.',
      inputSchema: z.object({
        packages: z.array(z.string()).min(1),
      }),
      execute: async ({ packages }) => {
        try {
          const result = await sandbox.installPackages(packages);
          return {
            ok: result.success,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
          };
        } catch (err) {
          rethrowIfLost(err);
          return { ok: false, error: errMsg(err) };
        }
      },
    }),

    run_command: tool({
      description:
        'Run a shell command in the project workspace (build, format, etc.). Avoid using this for file writes — use write_file instead. Avoid long-running processes (e.g. npm run dev) — the Vite dev server is already running.',
      inputSchema: z.object({
        command: z.string(),
      }),
      execute: async ({ command }) => {
        try {
          const result = await sandbox.runCommand(command);
          return {
            ok: result.success,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
          };
        } catch (err) {
          rethrowIfLost(err);
          return { ok: false, error: errMsg(err) };
        }
      },
    }),

    check_preview: tool({
      description:
        'Verify the live preview is actually rendering. ALWAYS call this after writing files — a syntax error, missing import, or removed JSX root will cause a white screen and the user will think your work was lost. Returns the URL status, recent Vite dev server log lines, and whether the page looks healthy. If looksHealthy is false, find the error in viteLog or bodyPreview, fix the underlying file, then call check_preview again.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const result = await checkPreview(sandbox, sandboxUrl);
          return { ok: true, ...result };
        } catch (err) {
          rethrowIfLost(err);
          return { ok: false, error: errMsg(err) };
        }
      },
    }),
  };
}

export type PreviewCheck = {
  looksHealthy: boolean;
  urlStatus: number;
  bodyHasErrorMarkup: boolean;
  bodyPreview: string;
  viteLog: string;
  reasons: string[];
  // Each user-source module the import graph walk found broken (404/500
  // from Vite, or fetch error). Empty array means the import chain is OK.
  brokenModules: { path: string; status: number; preview: string }[];
};

// Combined health check the agent (and the post-task verifier) can use to
// decide whether the user is about to see a white screen. Fetches the preview
// URL + tails the Vite dev server log inside the sandbox.
export async function checkPreview(
  sandbox: SandboxProvider,
  sandboxUrl: string,
): Promise<PreviewCheck> {
  const reasons: string[] = [];

  // 1. HTTP probe of the preview URL.
  let urlStatus = 0;
  let bodyPreview = '';
  let bodyHasErrorMarkup = false;
  let mainModuleOk = true;
  let entryPath: string | undefined;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(sandboxUrl, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'agentic-room-preview-check' },
    });
    clearTimeout(t);
    urlStatus = res.status;
    const body = await res.text();
    bodyPreview = body.slice(0, 1200);
    // Vite injects an error overlay element when there's a transform error.
    bodyHasErrorMarkup = /vite-error-overlay|Internal server error|Failed to (?:resolve|load) (?:module|import)/i.test(
      body,
    );
    if (urlStatus >= 400) reasons.push(`URL returned HTTP ${urlStatus}`);
    if (bodyHasErrorMarkup) reasons.push('Vite error overlay present in HTML');

    // The index HTML usually loads `/src/main.tsx` or `/src/main.jsx`. If that
    // module fails to transform, Vite returns 500 with the error text. Probe
    // both common entry points.
    const entryMatch = body.match(/src=["'](\/[^"']*main\.(?:tsx|jsx|ts|js))["']/);
    entryPath = entryMatch?.[1];
    if (entryPath) {
      try {
        const ctrl2 = new AbortController();
        const t2 = setTimeout(() => ctrl2.abort(), 6000);
        const moduleRes = await fetch(`${sandboxUrl}${entryPath}`, {
          signal: ctrl2.signal,
          headers: { 'user-agent': 'agentic-room-preview-check' },
        });
        clearTimeout(t2);
        if (moduleRes.status >= 400) {
          mainModuleOk = false;
          const moduleBody = await moduleRes.text();
          reasons.push(
            `entry module ${entryPath} returned HTTP ${moduleRes.status}: ${moduleBody.slice(0, 200)}`,
          );
        }
      } catch (mErr) {
        mainModuleOk = false;
        reasons.push(`entry module fetch failed: ${errMsg(mErr)}`);
      }
    }
  } catch (err) {
    reasons.push(`URL fetch failed: ${errMsg(err)}`);
  }

  // 2. Walk the import graph from the entry module.
  //
  // The biggest blind spot in a Vite + React preview is *runtime* import
  // failure: App.jsx imports ./components/Hero.jsx, but Hero.jsx doesn't
  // exist (typo / wrong extension / missing file). Vite serves App.jsx
  // happily; the browser fails when it tries to resolve the missing path,
  // throws in console, renders nothing → white screen. The vite.log doesn't
  // see it because Vite served the request fine.
  //
  // Simulating the browser: fetch each transitively-imported user-source
  // module and record any that 404/500. Cap depth + total fetches so a
  // wide graph doesn't blow the time budget.
  const brokenModules: { path: string; status: number; preview: string }[] = [];
  if (entryPath && mainModuleOk) {
    const MAX_DEPTH = 3;
    const MAX_FETCHES = 25;
    const visited = new Set<string>([entryPath]);
    const queue: { path: string; depth: number }[] = [{ path: entryPath, depth: 0 }];
    let fetches = 0;

    while (queue.length > 0 && fetches < MAX_FETCHES) {
      const item = queue.shift();
      if (!item) break;
      if (item.depth > MAX_DEPTH) continue;
      fetches++;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const modRes = await fetch(`${sandboxUrl}${item.path}`, {
          signal: ctrl.signal,
          headers: { 'user-agent': 'agentic-room-preview-check' },
        });
        clearTimeout(t);

        if (modRes.status >= 400) {
          const errBody = await modRes.text();
          brokenModules.push({
            path: item.path,
            status: modRes.status,
            preview: errBody.slice(0, 300),
          });
          continue;
        }

        // Vite transforms `from './foo'` into `from "/src/components/foo.jsx"`.
        // Only follow user-source paths (start with /src/); skip /node_modules,
        // /@vite, /@id, and bare imports.
        const modText = await modRes.text();
        const importRx = /from\s+["'](\/src\/[^"'?]+)(?:\?[^"']*)?["']/g;
        let m: RegExpExecArray | null;
        while ((m = importRx.exec(modText)) !== null) {
          const importPath = m[1];
          if (!visited.has(importPath)) {
            visited.add(importPath);
            queue.push({ path: importPath, depth: item.depth + 1 });
          }
        }
      } catch (err) {
        brokenModules.push({
          path: item.path,
          status: 0,
          preview: errMsg(err),
        });
      }
    }
  }

  if (brokenModules.length > 0) {
    for (const b of brokenModules.slice(0, 5)) {
      reasons.push(
        `module ${b.path} returned HTTP ${b.status || 'error'}: ${b.preview.slice(0, 180)}`,
      );
    }
    if (brokenModules.length > 5) {
      reasons.push(`(${brokenModules.length - 5} more broken modules omitted)`);
    }
  }

  // 3. Tail recent Vite log lines (only available if Vite was started with
  // file logging — newer provisions do this; older ones return a placeholder).
  let viteLog = '';
  try {
    const logResult = await sandbox.runCommand(
      'tail -n 80 /tmp/vite.log 2>/dev/null || echo "(vite log not captured — older sandbox)"',
    );
    viteLog = (logResult.stdout || '').trim();
  } catch {
    viteLog = '(could not read vite log)';
  }
  const hasViteError =
    /Internal server error|\[plugin:|Transform failed|Failed to resolve import|Unexpected token|SyntaxError/i.test(
      viteLog,
    );
  if (hasViteError) reasons.push('Vite log shows compile error');

  const looksHealthy =
    urlStatus >= 200 &&
    urlStatus < 400 &&
    !bodyHasErrorMarkup &&
    !hasViteError &&
    mainModuleOk &&
    brokenModules.length === 0;

  return {
    looksHealthy,
    urlStatus,
    bodyHasErrorMarkup,
    bodyPreview,
    viteLog: viteLog.slice(-2500),
    reasons,
    brokenModules,
  };
}

function errMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export type SandboxToolset = ReturnType<typeof createSandboxTools>;
