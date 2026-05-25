import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { groq } from '@ai-sdk/groq';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { rooms, tasks, type TaskEvent } from '@/lib/db/schema';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { createSandboxTools } from './sandbox-tools';
import { OBJECTIVE_LABELS, OUTPUT_TYPE_LABELS } from '@/lib/templates';

// ---------------------------------------------------------------------------
// Provider selection — modular, defaults to Gemini 2.5 Pro for coding.
// ---------------------------------------------------------------------------

type ExecProvider = 'google' | 'anthropic' | 'openai' | 'groq';

const DEFAULT_PROVIDER: ExecProvider =
  (process.env.EXEC_PROVIDER as ExecProvider) || 'google';

const DEFAULT_MODELS: Record<ExecProvider, string> = {
  google: process.env.EXEC_MODEL_GOOGLE || 'gemini-3.5-flash',
  anthropic: process.env.EXEC_MODEL_ANTHROPIC || 'claude-sonnet-4-5',
  openai: process.env.EXEC_MODEL_OPENAI || 'gpt-5',
  groq: process.env.EXEC_MODEL_GROQ || 'moonshotai/kimi-k2-instruct-0905',
};

function resolveModel() {
  const provider = DEFAULT_PROVIDER;
  const modelId = DEFAULT_MODELS[provider];
  switch (provider) {
    case 'google':
      return { model: google(modelId), label: `google/${modelId}`, provider };
    case 'anthropic':
      return { model: anthropic(modelId), label: `anthropic/${modelId}`, provider };
    case 'openai':
      return { model: openai(modelId), label: `openai/${modelId}`, provider };
    case 'groq':
      return { model: groq(modelId), label: `groq/${modelId}`, provider };
  }
}

// Per-provider extras (e.g. enable Gemini thinking for the executing agent —
// it's a multi-step coding task that benefits from reasoning; the classifier
// stays no-thinking for speed).
function execProviderOptions(provider: ExecProvider) {
  if (provider === 'google') {
    return {
      google: {
        thinkingConfig: {
          // -1 = dynamic budget; model decides how much to think per step
          thinkingBudget: -1,
          includeThoughts: false,
        },
      },
    } as const;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// System prompt for the executing coding agent
// ---------------------------------------------------------------------------

function buildSystemPrompt(room: typeof rooms.$inferSelect) {
  const ctx = (room.context ?? {}) as Record<string, unknown>;
  const contextLines: string[] = [];
  for (const [k, v] of Object.entries(ctx)) {
    if (!v) continue;
    contextLines.push(`- ${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
  }
  return `You are the **execution agent** for a live collaborative product-design room called "${room.title}".

The team is iteratively shaping a React + Vite + Tailwind artifact (a ${OBJECTIVE_LABELS[room.objective] ?? room.objective}, output as ${OUTPUT_TYPE_LABELS[room.outputType] ?? room.outputType}). A separate intelligence layer has watched their discussion, the host has approved a specific change, and your job is to apply ONLY that change to the project files in the sandbox.

# Project context
${contextLines.length > 0 ? contextLines.join('\n') : '(no additional context provided)'}

# Project structure
The sandbox runs a Vite React + TypeScript template at the project root. Key files:
- src/App.tsx — main component, rendered at /
- src/main.tsx — entry point
- src/components/ — for new components
- index.html — root HTML
Vite has HMR enabled, so any file you write triggers an immediate reload in the user's preview iframe.

# How to work
1. If you need to know what's in a file before editing, list_files / read_file FIRST.
2. Make the smallest set of changes that fulfills the instruction. Do NOT redesign the page.
3. Preserve existing styling and structure unless the instruction explicitly asks to change them.
4. Use Tailwind utility classes (already configured) — never write a separate CSS file.
5. If a new component is appropriate, create it under src/components/ and import it.
6. If you need a new npm package, use install_packages. Don't try to npm install via run_command.
7. Do not start dev servers. Vite is already running.
8. When done, briefly summarize what you changed in your final message (one paragraph).

# What NOT to do
- Don't change unrelated files.
- Don't add comments explaining what you did — the change should be self-evident from the diff.
- Don't write tests unless the instruction asks for them.
- Don't run \`npm run dev\` or \`npm run build\` — they're not needed.

You have these tools: list_files, read_file, write_file, install_packages, run_command.`;
}

// ---------------------------------------------------------------------------
// runTask
// ---------------------------------------------------------------------------

const MAX_STEPS = 30;

export async function runTask(taskId: string): Promise<void> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) throw new Error(`task ${taskId} not found`);

  const [room] = await db.select().from(rooms).where(eq(rooms.id, task.roomId)).limit(1);
  if (!room) throw new Error(`room ${task.roomId} not found`);

  const sandboxId = room.sandboxId;
  if (!sandboxId) {
    await failTask(task.id, room.id, 'room has no provisioned sandbox');
    return;
  }
  const sandbox = sandboxManager.getProvider(sandboxId);
  if (!sandbox) {
    await failTask(
      task.id,
      room.id,
      `sandbox ${sandboxId} is not registered with this Next.js process (likely a server restart). The user needs to recreate the room.`,
    );
    return;
  }

  const { model, label: modelLabel, provider: execProvider } = resolveModel();
  await db
    .update(tasks)
    .set({ status: 'running', startedAt: new Date(), model: modelLabel })
    .where(eq(tasks.id, task.id));

  const events: TaskEvent[] = [];
  const tools = createSandboxTools(sandbox);

  // Persist events to Postgres in batches so the polling GET /tasks endpoint
  // can surface progress between LLM steps. We don't broadcast over LiveKit
  // anymore — the data API rejects sendData for rooms with only WebRTC
  // participants ("Not Found: requested room does not exist") and made the
  // whole agent appear to crash mid-run.
  const flushEvents = async () => {
    await db.update(tasks).set({ events }).where(eq(tasks.id, task.id));
  };

  try {
    const result = await generateText({
      model,
      tools,
      providerOptions: execProviderOptions(execProvider),
      stopWhen: ({ steps }: { steps: unknown[] }) => steps.length >= MAX_STEPS,
      messages: [
        { role: 'system', content: buildSystemPrompt(room) },
        { role: 'user', content: task.instruction },
      ],
      onStepFinish: async ({ text, toolCalls, toolResults }) => {
        if (text?.trim()) {
          events.push({ ts: Date.now(), kind: 'text', text });
        }
        for (const tc of toolCalls ?? []) {
          events.push({
            ts: Date.now(),
            kind: 'tool_call',
            toolName: tc.toolName,
            data: summarizeToolInput(tc.toolName, tc.input),
          });
        }
        for (const tr of toolResults ?? []) {
          events.push({
            ts: Date.now(),
            kind: 'tool_result',
            toolName: tr.toolName,
            data: summarizeToolResult(tr.toolName, tr.output),
          });
        }
        await flushEvents();
      },
    });

    await db
      .update(tasks)
      .set({
        status: 'complete',
        completedAt: new Date(),
        summary: result.text || null,
        events,
      })
      .where(eq(tasks.id, task.id));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(tasks)
      .set({
        status: 'failed',
        completedAt: new Date(),
        error: message,
        events,
      })
      .where(eq(tasks.id, task.id));
  }
}

async function failTask(taskId: string, _roomId: string, error: string) {
  await db
    .update(tasks)
    .set({ status: 'failed', error, completedAt: new Date() })
    .where(eq(tasks.id, taskId));
}

// Trim verbose payloads so the timeline UI stays readable.
function summarizeToolInput(name: string, input: unknown): unknown {
  if (name === 'write_file' && typeof input === 'object' && input !== null) {
    const { path, content } = input as { path: string; content: string };
    return { path, bytes: content?.length ?? 0 };
  }
  return input;
}

function summarizeToolResult(name: string, output: unknown): unknown {
  if (name === 'read_file' && typeof output === 'object' && output !== null) {
    const r = output as { ok?: boolean; content?: string; error?: string };
    return r.ok
      ? { ok: true, bytes: r.content?.length ?? 0 }
      : { ok: false, error: r.error };
  }
  if (name === 'list_files' && typeof output === 'object' && output !== null) {
    const r = output as { ok?: boolean; files?: string[]; error?: string };
    return r.ok ? { ok: true, count: r.files?.length ?? 0 } : { ok: false, error: r.error };
  }
  if (
    (name === 'run_command' || name === 'install_packages') &&
    typeof output === 'object' &&
    output !== null
  ) {
    const r = output as { ok?: boolean; exitCode?: number; error?: string };
    return { ok: r.ok, exitCode: r.exitCode, error: r.error };
  }
  return output;
}
