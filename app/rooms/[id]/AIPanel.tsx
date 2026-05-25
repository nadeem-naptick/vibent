'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DetectedIntent, IntentType, TranscriptSegment } from '@/lib/db/mongo';
import type { LiveTask } from './types';

type Tab = 'transcript' | 'detected' | 'decisions' | 'tasks' | 'open';

const TAB_LABELS: Record<Tab, string> = {
  transcript: 'Transcript',
  detected: 'Detected',
  decisions: 'Decisions',
  tasks: 'Tasks',
  open: 'Open',
};

type Props = {
  transcripts: TranscriptSegment[];
  intents: DetectedIntent[];
  tasks: LiveTask[];
  isHost: boolean;
  onUpdateIntent: (intentId: string, patch: { status: DetectedIntent['status'] }) => void;
};

export function AIPanel({
  transcripts,
  intents,
  tasks,
  isHost,
  onUpdateIntent,
}: Props) {
  const [tab, setTab] = useState<Tab>('decisions');

  const grouped = useMemo(() => groupIntents(intents), [intents]);

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-100">
      <div className="border-b border-neutral-900">
        <nav className="flex">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
            const count = tabCount(t, transcripts, grouped, tasks);
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
          <IntentList
            intents={grouped.detected}
            empty="No detected ideas or constraints yet."
            renderActions={null}
          />
        )}
        {tab === 'decisions' && (
          <IntentList
            intents={grouped.pendingDecisions}
            empty="No pending decisions."
            renderActions={(intent) =>
              isHost ? (
                <div className="flex gap-2 mt-2">
                  <ActionButton
                    onClick={() => onUpdateIntent(intent.id, { status: 'approved' })}
                    variant="primary"
                  >
                    Apply
                  </ActionButton>
                  <ActionButton
                    onClick={() => onUpdateIntent(intent.id, { status: 'ignored' })}
                  >
                    Ignore
                  </ActionButton>
                </div>
              ) : null
            }
          />
        )}
        {tab === 'tasks' && <TaskList tasks={tasks} />}
        {tab === 'open' && (
          <IntentList
            intents={grouped.openQuestions}
            empty="No open questions."
            renderActions={null}
          />
        )}
      </div>
    </div>
  );
}

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

function IntentList({
  intents,
  empty,
  renderActions,
}: {
  intents: DetectedIntent[];
  empty: string;
  renderActions: ((intent: DetectedIntent) => React.ReactNode) | null;
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
          {renderActions?.(intent)}
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <p className="text-sm text-neutral-500 text-center">{children}</p>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary';
}) {
  const base = 'text-xs px-3 py-1 rounded font-medium transition-colors';
  const styles =
    variant === 'primary'
      ? 'bg-neutral-100 text-neutral-950 hover:bg-white'
      : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800 border border-neutral-800';
  return (
    <button onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
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

type Grouped = {
  detected: DetectedIntent[];
  pendingDecisions: DetectedIntent[];
  applied: DetectedIntent[];
  openQuestions: DetectedIntent[];
};

function groupIntents(intents: DetectedIntent[]): Grouped {
  const detected: DetectedIntent[] = [];
  const pendingDecisions: DetectedIntent[] = [];
  const applied: DetectedIntent[] = [];
  const openQuestions: DetectedIntent[] = [];

  for (const i of intents) {
    if (i.type === 'open_question' && i.status === 'pending_approval') {
      openQuestions.push(i);
      continue;
    }
    if (i.status === 'applied' || i.status === 'approved') {
      applied.push(i);
      continue;
    }
    if (i.shouldExecute || i.type === 'decision' || i.type === 'instruction' || i.type === 'approved_execution_task') {
      if (i.status === 'pending_approval') {
        pendingDecisions.push(i);
        continue;
      }
    }
    if (i.status === 'pending_approval' && i.type !== 'noise') {
      detected.push(i);
    }
  }
  return { detected, pendingDecisions, applied, openQuestions };
}

function tabCount(
  tab: Tab,
  transcripts: TranscriptSegment[],
  grouped: Grouped,
  tasks: LiveTask[],
) {
  switch (tab) {
    case 'transcript':
      return transcripts.length || null;
    case 'detected':
      return grouped.detected.length || null;
    case 'decisions':
      return grouped.pendingDecisions.length || null;
    case 'tasks':
      return tasks.length || null;
    case 'open':
      return grouped.openQuestions.length || null;
  }
}

// ---------------------------------------------------------------------------
// Tasks tab — live agent timeline
// ---------------------------------------------------------------------------

function TaskList({ tasks }: { tasks: LiveTask[] }) {
  if (tasks.length === 0) {
    return (
      <Empty>
        Approve a decision and the execution agent will start modifying the
        artifact here.
      </Empty>
    );
  }
  // Show position-in-queue for queued tasks (FIFO).
  const queuedOrder = tasks
    .filter((t) => t.status === 'queued')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((t) => t.id);

  return (
    <ul className="divide-y divide-neutral-900">
      {tasks.map((task) => {
        const queuePos = queuedOrder.indexOf(task.id);
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
    if (event.toolName === 'write_file' && data) {
      detail = `${data.path} (${data.bytes ?? 0}B)`;
    } else if (event.toolName === 'read_file' && data) {
      detail = String(data.path ?? '');
    } else if (event.toolName === 'list_files' && data) {
      detail = String(data.directory ?? '');
    } else if (event.toolName === 'install_packages' && data) {
      const pkgs = (data.packages as string[]) ?? [];
      detail = pkgs.join(' ');
    } else if (event.toolName === 'run_command' && data) {
      detail = String(data.command ?? '');
    }
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
