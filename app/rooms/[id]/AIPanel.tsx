'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DetectedIntent, IntentType, TranscriptSegment } from '@/lib/db/mongo';
import type { LiveTask, LiveVersion } from './types';
import { VersionsTab } from './VersionsTab';
import { useAutoCompose } from './useAutoCompose';

type Tab = 'transcript' | 'detected' | 'tasks' | 'versions' | 'open';

const TAB_LABELS: Record<Tab, string> = {
  transcript: 'Transcript',
  detected: 'Detected',
  tasks: 'Tasks',
  versions: 'Versions',
  open: 'Open',
};

type Props = {
  roomId: string;
  transcripts: TranscriptSegment[];
  intents: DetectedIntent[];
  tasks: LiveTask[];
  versions: LiveVersion[];
  isHost: boolean;
  onUpdateIntent: (intentId: string, patch: { status: DetectedIntent['status'] }) => void;
  onRolledBack: () => void;
};

export function AIPanel({
  roomId,
  transcripts,
  intents,
  tasks,
  versions,
  isHost,
  onUpdateIntent,
  onRolledBack,
}: Props) {
  const [tab, setTab] = useState<Tab>('detected');

  const grouped = useMemo(() => groupIntents(intents), [intents]);

  // Auto-compose lifecycle: pending countdown → pool accumulator → auto-submit
  // when threshold reached. The host can intervene at any stage via X.
  const autoCompose = useAutoCompose({
    roomId,
    intents,
    isHost,
    onIgnoreIntent: (id) => onUpdateIntent(id, { status: 'ignored' }),
    onPoolComposed: () => setTab('tasks'),
  });

  return (
    <div className="relative flex flex-col h-full bg-neutral-950 text-neutral-100">
      <div className="border-b border-neutral-900">
        <nav className="flex">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
            const count = tabCount(t, transcripts, grouped, tasks, versions);
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-2 py-2 text-xs uppercase tracking-wider border-b-2 transition-colors ${
                  tab === t
                    ? 'border-neutral-100 text-neutral-100'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {TAB_LABELS[t]}
                {count !== null && (
                  <span className="ml-1 text-[10px] text-neutral-600">{count}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'transcript' && <TranscriptList transcripts={transcripts} />}
        {tab === 'detected' && (
          <DetectedTab
            pending={autoCompose.pending}
            pool={autoCompose.pool}
            threshold={autoCompose.threshold}
            composing={autoCompose.composing}
            onRemovePending={autoCompose.removePending}
            onRemoveFromPool={autoCompose.removeFromPool}
            isHost={isHost}
          />
        )}
        {tab === 'tasks' && <TaskList tasks={tasks} />}
        {tab === 'versions' && (
          <VersionsTab
            roomId={roomId}
            versions={versions}
            isHost={isHost}
            onRolledBack={onRolledBack}
          />
        )}
        {tab === 'open' && (
          <IntentList
            intents={grouped.openQuestions}
            empty="No open questions."
          />
        )}
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function TranscriptList({ transcripts }: { transcripts: TranscriptSegment[] }) {
  if (transcripts.length === 0) {
    return <Empty>Transcript will appear here as participants speak.</Empty>;
  }
  return (
    <ul className="divide-y divide-neutral-900">
      {transcripts.map((s) => (
        <li key={s.id} className="px-4 py-2.5 text-sm">
          <div className="text-xs text-neutral-500 mb-0.5">{s.speakerName}</div>
          <div className="text-neutral-200 leading-snug">{s.text}</div>
        </li>
      ))}
    </ul>
  );
}

function DetectedTab({
  pending,
  pool,
  threshold,
  composing,
  onRemovePending,
  onRemoveFromPool,
  isHost,
}: {
  pending: { intent: DetectedIntent; msLeft: number; progress: number }[];
  pool: DetectedIntent[];
  threshold: number;
  composing: boolean;
  onRemovePending: (intentId: string) => void;
  onRemoveFromPool: (intentId: string) => void;
  isHost: boolean;
}) {
  if (pending.length === 0 && pool.length === 0 && !composing) {
    return (
      <Empty>
        Detections will appear here as participants speak. Each one gets a
        5-second window to be removed — survivors auto-bundle into a decision
        once {threshold} have accumulated.
      </Empty>
    );
  }

  return (
    <div>
      {/* Live (still-counting) detections, stacked newest on top */}
      {pending.length > 0 && (
        <ul className="divide-y divide-neutral-900">
          {pending.map(({ intent, msLeft, progress }) => (
            <li key={intent.id} className="relative px-3 py-2.5">
              {/* Progress bar — depletes from full to empty across the countdown */}
              <div
                className="absolute left-0 top-0 h-0.5 bg-neutral-100/70 transition-[width] duration-200 linear"
                style={{ width: `${progress * 100}%` }}
                aria-hidden
              />
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <TypeBadge type={intent.type} />
                    <span className="text-[11px] text-neutral-500">
                      {intent.speakerName} · {(intent.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-neutral-500 ml-auto tabular-nums">
                      {(msLeft / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <div className="text-sm text-neutral-200 leading-snug">{intent.summary}</div>
                  <div className="text-xs text-neutral-600 mt-1 italic leading-snug">
                    "{intent.rawText}"
                  </div>
                </div>
                {isHost && (
                  <button
                    onClick={() => onRemovePending(intent.id)}
                    title="Discard"
                    className="text-neutral-600 hover:text-red-400 text-base leading-none w-5 h-5 flex items-center justify-center"
                  >
                    ×
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Composing pool — collapsed by default, expand to see/edit each item */}
      {pool.length > 0 && (
        <ComposingPoolCard
          pool={pool}
          threshold={threshold}
          composing={composing}
          onRemoveFromPool={onRemoveFromPool}
          isHost={isHost}
        />
      )}

      {composing && pool.length === 0 && (
        <div className="px-4 py-3 text-xs text-neutral-500 flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
          Composing decision…
        </div>
      )}
    </div>
  );
}

function ComposingPoolCard({
  pool,
  threshold,
  composing,
  onRemoveFromPool,
  isHost,
}: {
  pool: DetectedIntent[];
  threshold: number;
  composing: boolean;
  onRemoveFromPool: (intentId: string) => void;
  isHost: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.min(100, Math.round((pool.length / threshold) * 100));

  return (
    <div className="border-t border-neutral-900 bg-neutral-950">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-neutral-900/40 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs uppercase tracking-widest text-neutral-500">
              Composing decision
            </span>
            <span className="text-xs text-neutral-400 tabular-nums">
              {pool.length} / {threshold}
            </span>
            {composing && (
              <span className="text-[10px] text-blue-400">submitting…</span>
            )}
          </div>
          <div className="h-1 rounded-full bg-neutral-900 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-neutral-500">
          {expanded ? '−' : '+'}
        </span>
      </button>
      {expanded && (
        <ul className="divide-y divide-neutral-900 border-t border-neutral-900">
          {pool.map((intent) => (
            <li key={intent.id} className="px-3 py-2 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <TypeBadge type={intent.type} />
                  <span className="text-[10px] text-neutral-500">
                    {intent.speakerName}
                  </span>
                </div>
                <div className="text-xs text-neutral-300 leading-snug">{intent.summary}</div>
              </div>
              {isHost && (
                <button
                  onClick={() => onRemoveFromPool(intent.id)}
                  title="Remove from this decision"
                  className="text-neutral-600 hover:text-red-400 text-base leading-none w-5 h-5 flex items-center justify-center"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IntentList({
  intents,
  empty,
}: {
  intents: DetectedIntent[];
  empty: string;
}) {
  if (intents.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-neutral-900">
      {intents.map((intent) => (
        <li key={intent.id} className="px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <TypeBadge type={intent.type} />
            <span className="text-[11px] text-neutral-500">
              {intent.speakerName} · {(intent.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="text-sm text-neutral-200 leading-snug">{intent.summary}</div>
          <div className="text-xs text-neutral-600 mt-1 italic">"{intent.rawText}"</div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Tasks tab
// ---------------------------------------------------------------------------

function TaskList({ tasks }: { tasks: LiveTask[] }) {
  if (tasks.length === 0) {
    return (
      <Empty>
        Compose a decision and the execution agent will start modifying the
        artifact here.
      </Empty>
    );
  }
  const queuedOrder = tasks
    .filter((t) => t.status === 'queued')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((t) => t.id);

  return (
    <ul className="divide-y divide-neutral-900">
      {tasks.map((task) => {
        const queuePos = queuedOrder.indexOf(task.id);
        const sources = task.sourceIntentIds ?? undefined;
        return (
          <li key={task.id} className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <TaskStatusBadge status={task.status} />
              {task.status === 'queued' && queuePos >= 0 && (
                <span className="text-[10px] text-neutral-500">
                  position {queuePos + 1}
                </span>
              )}
              <TaskTimer task={task} />
              {sources && sources.length > 0 && (
                <span className="text-[10px] text-neutral-600">
                  · merged from {sources.length} detection{sources.length === 1 ? '' : 's'}
                </span>
              )}
              {task.model && (
                <span className="text-[10px] text-neutral-600 ml-auto">{task.model}</span>
              )}
            </div>
            <div className="text-sm text-neutral-200 leading-snug">{task.instruction}</div>
            {task.events.length > 0 && (
              <ol className="mt-2 space-y-1 border-l border-neutral-800 pl-3">
                {task.events.map((ev, i) => (
                  <li key={i} className="text-xs text-neutral-500 leading-snug">
                    <EventLine event={ev} />
                  </li>
                ))}
              </ol>
            )}
            {task.summary && task.status === 'complete' && (
              <div className="text-xs text-neutral-400 italic mt-2 leading-snug">
                {task.summary}
              </div>
            )}
            {task.error && (
              <div className="text-xs text-red-400 mt-2 leading-snug font-mono">
                {task.error}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function TaskStatusBadge({ status }: { status: LiveTask['status'] }) {
  const colors: Record<LiveTask['status'], string> = {
    queued: 'bg-neutral-900 text-neutral-400 border-neutral-800',
    running: 'bg-blue-950 text-blue-300 border-blue-900 animate-pulse',
    complete: 'bg-emerald-950 text-emerald-300 border-emerald-900',
    failed: 'bg-red-950 text-red-300 border-red-900',
    cancelled: 'bg-neutral-900 text-neutral-500 border-neutral-800',
  };
  const labels: Record<LiveTask['status'], string> = {
    queued: 'queued',
    running: 'running…',
    complete: 'complete',
    failed: 'failed',
    cancelled: 'cancelled',
  };
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${colors[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function TaskTimer({ task }: { task: LiveTask }) {
  const [now, setNow] = useState(() => Date.now());
  const isLive = task.status === 'running';
  useEffect(() => {
    if (!isLive) return;
    const i = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(i);
  }, [isLive]);
  if (!task.startedAt) return null;
  const start = new Date(task.startedAt).getTime();
  const end = task.completedAt ? new Date(task.completedAt).getTime() : now;
  const sec = Math.max(0, Math.round((end - start) / 1000));
  return <span className="text-[10px] text-neutral-500 tabular-nums">{sec}s</span>;
}

function EventLine({ event }: { event: LiveTask['events'][number] }) {
  if (event.kind === 'tool_call') {
    const data = event.data as Record<string, unknown> | undefined;
    let detail = '';
    if (event.toolName === 'write_file' && data) detail = `${data.path} (${data.bytes ?? 0}B)`;
    else if (event.toolName === 'read_file' && data) detail = String(data.path ?? '');
    else if (event.toolName === 'list_files' && data) detail = String(data.directory ?? '');
    else if (event.toolName === 'install_packages' && data) {
      const pkgs = (data.packages as string[]) ?? [];
      detail = pkgs.join(' ');
    } else if (event.toolName === 'run_command' && data) detail = String(data.command ?? '');
    return (
      <>
        <span className="text-neutral-400">{event.toolName}</span>{' '}
        <span>{detail}</span>
      </>
    );
  }
  if (event.kind === 'tool_result') {
    const data = event.data as { ok?: boolean; error?: string } | undefined;
    return (
      <span className={data?.ok === false ? 'text-red-400' : 'text-neutral-600'}>
        {event.toolName} → {data?.ok === false ? `failed: ${data.error}` : 'ok'}
      </span>
    );
  }
  if (event.kind === 'text') {
    return <span className="text-neutral-400">{event.text}</span>;
  }
  return <span className="text-red-400">{event.text ?? 'error'}</span>;
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <p className="text-sm text-neutral-500 text-center">{children}</p>
    </div>
  );
}

const TYPE_COLORS: Record<IntentType, string> = {
  idea: 'bg-blue-950 text-blue-300 border-blue-900',
  question: 'bg-purple-950 text-purple-300 border-purple-900',
  decision: 'bg-emerald-950 text-emerald-300 border-emerald-900',
  instruction: 'bg-amber-950 text-amber-300 border-amber-900',
  correction: 'bg-orange-950 text-orange-300 border-orange-900',
  rejected_idea: 'bg-neutral-900 text-neutral-500 border-neutral-800',
  open_question: 'bg-violet-950 text-violet-300 border-violet-900',
  constraint: 'bg-rose-950 text-rose-300 border-rose-900',
  action_item: 'bg-cyan-950 text-cyan-300 border-cyan-900',
  reference: 'bg-indigo-950 text-indigo-300 border-indigo-900',
  approved_execution_task: 'bg-emerald-900 text-emerald-200 border-emerald-700',
  noise: 'bg-neutral-900 text-neutral-600 border-neutral-800',
};

function TypeBadge({ type }: { type: IntentType }) {
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${TYPE_COLORS[type]}`}
    >
      {type.replace(/_/g, ' ')}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

type Grouped = {
  active: DetectedIntent[];        // candidates for composition
  openQuestions: DetectedIntent[]; // separate tab
};

function groupIntents(intents: DetectedIntent[]): Grouped {
  const active: DetectedIntent[] = [];
  const openQuestions: DetectedIntent[] = [];
  for (const i of intents) {
    // Filter out resolved + noise
    if (i.status !== 'pending_approval') continue;
    if (i.type === 'noise') continue;
    if (i.type === 'open_question') {
      openQuestions.push(i);
      continue;
    }
    active.push(i);
  }
  return { active, openQuestions };
}

function tabCount(
  tab: Tab,
  transcripts: TranscriptSegment[],
  grouped: Grouped,
  tasks: LiveTask[],
  versions: LiveVersion[],
) {
  switch (tab) {
    case 'transcript':
      return transcripts.length || null;
    case 'detected':
      return grouped.active.length || null;
    case 'tasks':
      return tasks.length || null;
    case 'versions':
      return versions.length || null;
    case 'open':
      return grouped.openQuestions.length || null;
  }
}
