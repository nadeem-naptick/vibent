import { tool } from 'ai';
import { z } from 'zod';
import type { SandboxProvider } from '@/lib/sandbox/types';

// Tools the execution agent uses to read/write/run things inside the room's
// per-room sandbox. Thin wrappers over SandboxProvider so the model sees a
// clean, intent-aligned surface area.
//
// All paths are project-root-relative. The sandbox provider already
// normalises to its working directory (/vercel/sandbox for Vercel).
export function createSandboxTools(sandbox: SandboxProvider) {
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
          return { ok: false, error: errMsg(err) };
        }
      },
    }),
  };
}

function errMsg(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export type SandboxToolset = ReturnType<typeof createSandboxTools>;
