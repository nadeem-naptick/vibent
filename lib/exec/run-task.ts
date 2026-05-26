import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { groq } from '@ai-sdk/groq';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { rooms, tasks, type TaskEvent } from '@/lib/db/schema';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { createSandboxTools, SandboxLostError, checkPreview } from './sandbox-tools';
import { createVersion } from '@/lib/snapshots/manager';
import { sandboxManager as sandboxManagerForRetry } from '@/lib/sandbox/sandbox-manager';
import { provisionRoomSandbox } from '@/lib/sandbox/room-sandbox';
import { db as dbForRetry } from '@/lib/db';
import { rooms as roomsForRetry } from '@/lib/db/schema';
import { eq as eqForRetry } from 'drizzle-orm';
import { getTemplate } from '@/lib/templates';

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
function execProviderOptions(provider: ExecProvider, thinkingOn: boolean) {
  if (provider === 'google') {
    return {
      google: {
        thinkingConfig: {
          // -1 = dynamic budget (model decides); 0 = thinking disabled
          thinkingBudget: thinkingOn ? -1 : 0,
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
  const template = getTemplate(room.templateId);

  // Artifact kind — prefer template metadata, fall back to legacy enum strings.
  const artifactKind =
    template?.artifactKind ??
    (room.objective ? String(room.objective).replace(/_/g, ' ') : 'digital artifact');

  // Template-specific structural conventions (the heart of the template system).
  const artifactDirectionBlock = template
    ? `\n\n# Artifact direction (${template.artifactKind})\n${template.executorAddendum}\n`
    : '';

  // Free-form host instructions written at room creation. Treated as the
  // most authoritative project context — appended verbatim.
  const instructionsBlock = room.instructions?.trim()
    ? `\n\n# Host instructions\n${room.instructions.trim()}\n`
    : '';

  // Legacy structured context (audience/tone/brand colors) — kept for
  // back-compat with rooms created before the templates redesign.
  const ctx = (room.context ?? {}) as Record<string, unknown>;
  const contextLines: string[] = [];
  for (const [k, v] of Object.entries(ctx)) {
    if (!v) continue;
    contextLines.push(`- ${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
  }
  const legacyContextBlock =
    contextLines.length > 0 ? `\n\n# Legacy project context\n${contextLines.join('\n')}\n` : '';

  return `You are the **execution agent** for a live collaborative product-design room called "${room.title}".

The team is iteratively shaping a React + Vite + Tailwind artifact (a ${artifactKind}). A separate intelligence layer has watched their discussion, the host has approved a specific change, and your job is to apply ONLY that change to the project files in the sandbox.${artifactDirectionBlock}${instructionsBlock}${legacyContextBlock}

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
8. **After your last write_file, ALWAYS call check_preview.** If it reports \`looksHealthy: false\`, read the \`reasons\` / \`viteLog\` / \`bodyPreview\`, identify the broken file, fix it with write_file, and call check_preview again. Do not finish until \`looksHealthy: true\` — otherwise the user gets a white screen.
9. When the preview is healthy, briefly summarize what you changed in your final message (one paragraph).

# Avoiding white screens — common causes
- Removed or missing import that your new JSX references
- Syntax error in JSX (unclosed tag, stray brace)
- Wrong file extension (writing src/App.jsx when project uses src/App.tsx)
- Accidentally deleted the \`<App />\` render in main.tsx or the \`<div id="root">\` in index.html
- Importing a component file you forgot to create
If check_preview shows a Vite error, the fix is almost always in the file mentioned in the error.

# What NOT to do
- Don't change unrelated files.
- Don't add comments explaining what you did — the change should be self-evident from the diff.
- Don't write tests unless the instruction asks for them.
- Don't run \`npm run dev\` or \`npm run build\` — they're not needed.

You have these tools: list_files, read_file, write_file, install_packages, run_command, check_preview.`;
}

// ---------------------------------------------------------------------------
// runTask
// ---------------------------------------------------------------------------

const MAX_STEPS = 30;

// In-process registry of AbortControllers for currently-running tasks so the
// /api/tasks/[id]/cancel endpoint can interrupt them mid-flight.
const taskControllers = new Map<string, AbortController>();

export function isTaskRunning(taskId: string): boolean {
  return taskControllers.has(taskId);
}

export function cancelRunningTask(taskId: string): boolean {
  const controller = taskControllers.get(taskId);
  if (!controller) return false;
  controller.abort('cancelled by user');
  return true;
}

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
  let sandbox = sandboxManager.getProvider(sandboxId);
  if (!sandbox) {
    // Server restart wiped our in-memory registration. Try to reattach to
    // the existing Vercel/E2B sandbox by ID — usually still alive even if
    // we lost the handle.
    const { reattachSandbox } = await import('@/lib/sandbox/reattach');
    sandbox = await reattachSandbox(sandboxId, room.sandboxUrl ?? '');
    if (!sandbox) {
      await failTask(
        task.id,
        room.id,
        `Could not reattach to sandbox ${sandboxId}. It may have expired — click "Recreate sandbox" in the preview area to start fresh.`,
      );
      return;
    }
    console.log(`[run-task] reattached to sandbox ${sandboxId} for room ${room.id}`);
  }

  const { model, label: modelLabel, provider: execProvider } = resolveModel();
  await db
    .update(tasks)
    .set({ status: 'running', startedAt: new Date(), model: modelLabel })
    .where(eq(tasks.id, task.id));

  const events: TaskEvent[] = [];
  const tools = createSandboxTools(sandbox, room.sandboxUrl ?? '');

  // Register abort controller so /api/tasks/[id]/cancel can stop us
  const abortController = new AbortController();
  taskControllers.set(task.id, abortController);

  // Persist events to Postgres in batches so the polling GET /tasks endpoint
  // can surface progress between LLM steps. We don't broadcast over LiveKit
  // anymore — the data API rejects sendData for rooms with only WebRTC
  // participants ("Not Found: requested room does not exist") and made the
  // whole agent appear to crash mid-run.
  const flushEvents = async () => {
    await db.update(tasks).set({ events }).where(eq(tasks.id, task.id));
  };

  try {
    const thinkingOn = task.thinkingMode !== 0;
    const systemPrompt = buildSystemPrompt(room);
    const onStep = async ({ text, toolCalls, toolResults }: {
      text?: string;
      toolCalls?: Array<{ toolName: string; input: unknown }>;
      toolResults?: Array<{ toolName: string; output: unknown }>;
    }) => {
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
    };

    let result = await generateText({
      model,
      tools,
      providerOptions: execProviderOptions(execProvider, thinkingOn),
      abortSignal: abortController.signal,
      stopWhen: ({ steps }: { steps: unknown[] }) => steps.length >= MAX_STEPS,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: task.instruction },
      ],
      onStepFinish: onStep,
    });

    // Post-task verification + auto-fix loop. If the agent claims done but
    // the preview is actually broken (white screen, build error), feed the
    // error back and let it try again. This is the safety net for when the
    // model forgets to call check_preview or misses a build break.
    const MAX_FIX_PASSES = 2;
    if (room.sandboxUrl) {
      for (let pass = 1; pass <= MAX_FIX_PASSES; pass++) {
        let preview;
        try {
          preview = await checkPreview(sandbox, room.sandboxUrl);
        } catch (err) {
          console.warn('[run-task] post-task preview check threw:', err);
          break;
        }
        if (preview.looksHealthy) {
          if (pass > 1) {
            console.log(`[run-task] preview healthy after auto-fix pass ${pass - 1}`);
          }
          break;
        }
        console.warn(
          `[run-task] preview broken after agent finished (pass ${pass}): ${preview.reasons.join('; ')}`,
        );
        events.push({
          ts: Date.now(),
          kind: 'text',
          text: `⚠️ Preview check failed: ${preview.reasons.join('; ')}. Auto-fixing...`,
        });
        await flushEvents();

        // Continue the conversation with the broken-preview context. The
        // model retains tool access and can read/write files to fix things.
        const responseMessages = result.response?.messages ?? [];
        const fixInstruction =
          `The preview is currently BROKEN — the user will see a white screen.\n\n` +
          `Reasons reported:\n${preview.reasons.map((r) => `- ${r}`).join('\n')}\n\n` +
          (preview.viteLog ? `Recent Vite log:\n\`\`\`\n${preview.viteLog}\n\`\`\`\n\n` : '') +
          (preview.bodyPreview
            ? `Body preview:\n\`\`\`html\n${preview.bodyPreview}\n\`\`\`\n\n`
            : '') +
          `Find the broken file, fix it, then call check_preview to confirm. Do NOT redo unrelated work — just fix the build/runtime error.`;

        result = await generateText({
          model,
          tools,
          providerOptions: execProviderOptions(execProvider, thinkingOn),
          abortSignal: abortController.signal,
          stopWhen: ({ steps }: { steps: unknown[] }) => steps.length >= 10,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: task.instruction },
            ...responseMessages,
            { role: 'user', content: fixInstruction },
          ],
          onStepFinish: onStep,
        });
      }
    }

    await db
      .update(tasks)
      .set({
        status: 'complete',
        completedAt: new Date(),
        summary: result.text || null,
        events,
      })
      .where(eq(tasks.id, task.id));

    // Snapshot the sandbox so this completed task becomes a rollback target.
    // Don't fail the task on snapshot error — the change already shipped to
    // the iframe; users just lose rollback for this particular step.
    try {
      await createVersion({
        roomId: room.id,
        sandbox,
        summary:
          (result.text && result.text.trim().slice(0, 200)) || task.instruction.slice(0, 200),
        taskId: task.id,
      });
    } catch (snapErr) {
      console.warn('[run-task] post-task snapshot failed:', snapErr);
    }
  } catch (err) {
    const isAbort =
      abortController.signal.aborted ||
      (err instanceof Error &&
        (err.name === 'AbortError' || /abort/i.test(err.message)));
    const isSandboxLost = err instanceof SandboxLostError;
    const rawMessage = err instanceof Error ? err.message : String(err);
    const friendlyMessage = isAbort
      ? 'Cancelled by user'
      : isSandboxLost
      ? `Sandbox expired during execution. A fresh one is being provisioned — try this task again in 30–60s.`
      : rawMessage;

    await db
      .update(tasks)
      .set({
        status: isAbort ? 'cancelled' : 'failed',
        completedAt: new Date(),
        error: friendlyMessage,
        events,
      })
      .where(eq(tasks.id, task.id));

    // Sandbox died mid-task: kick off background recreation so the room is
    // usable again on the user's next attempt.
    if (isSandboxLost) {
      console.warn('[run-task] sandbox lost mid-task — triggering recreate');
      // Remove the dead handle from the manager so the next task tries to
      // reattach (which will fail) and then recreates.
      try {
        sandboxManagerForRetry.terminateSandbox(sandboxId).catch(() => {});
      } catch {
        // ignore
      }
      // Best-effort recreate in the background; updates room with new
      // sandboxId/url when done. Don't await — let the user see "expired"
      // first and decide to retry.
      provisionRoomSandbox(room.id)
        .then(async (fresh) => {
          await dbForRetry
            .update(roomsForRetry)
            .set({
              sandboxId: fresh.sandboxId,
              sandboxUrl: fresh.url,
              status: 'active',
              updatedAt: new Date(),
            })
            .where(eqForRetry(roomsForRetry.id, room.id));
          console.log('[run-task] recreate succeeded for room', room.id);
        })
        .catch((rerr) => {
          console.error('[run-task] recreate after sandbox loss failed:', rerr);
        });
    }

    // On cancel, restore the sandbox to the state it was in BEFORE this task
    // started (the latest pre-task version snapshot) so the iframe rolls
    // back any partial writes the agent made.
    if (isAbort) {
      try {
        const { getLatestVersion } = await import('@/lib/snapshots/manager');
        const { snapshotStore } = await import('@/lib/snapshots/store');
        const { restoreProject } = await import('@/lib/snapshots/snapshot');
        const latest = await getLatestVersion(room.id);
        if (latest) {
          const snap = await snapshotStore().load(latest.snapshotPath);
          await restoreProject(sandbox, snap);
          console.log(`[run-task] cancelled task ${task.id} — rolled back to v${latest.versionNumber}`);
        }
      } catch (rollbackErr) {
        console.warn('[run-task] post-cancel rollback failed:', rollbackErr);
      }
    }
  } finally {
    taskControllers.delete(task.id);
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
