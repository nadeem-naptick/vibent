'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DetectedIntent, IntentType, TranscriptSegment } from '@/lib/db/mongo';
import type { LiveTask, LiveVersion } from './types';
import { ComposeDecisionModal } from './ComposeDecisionModal';
import { VersionsTab } from './VersionsTab';

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

  // Selection of detections that will become a composed decision.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState(false);

  const grouped = useMemo(() => groupIntents(intents), [intents]);
  const selectedIntents = useMemo(
    () => grouped.active.filter((i) => selectedIds.has(i.id)),
    [grouped.active, selectedIds],
  );

  // Prune selection if intents change underneath (e.g. one got ignored).
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const i of grouped.active) if (prev.has(i.id)) next.add(i.id);
      return next.size === prev.size ? prev : next;
    });
  }, [grouped.active]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function removeFromCompose(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function onComposeSubmitted() {
    setComposing(false);
    clearSelection();
    setTab('tasks');
  }

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

      <div className={`flex-1 overflow-y-auto ${selectedIds.size > 0 ? 'pb-16' : ''}`}>
        {tab === 'transcript' && <TranscriptList transcripts={transcripts} />}
        {tab === 'detected' && (
          <DetectionList
            intents={grouped.active}
            selectedIds={selectedIds}
            onToggle={toggleSelect}
            onIgnore={(id) => onUpdateIntent(id, { status: 'ignored' })}
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

      {/* Sticky compose bar */}
      {isHost && selectedIds.size > 0 && tab === 'detected' && (
        <div className="absolute bottom-0 left-0 right-0 border-t border-neutral-800 bg-neutral-950 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-medium">{selectedIds.size} selected</span>
            <button
              onClick={clearSelection}
              className="text-neutral-500 hover:text-neutral-300"
            >
              clear
            </button>
          </div>
          <button
            onClick={() => setComposing(true)}
            className="text-xs rounded bg-neutral-100 text-neutral-950 px-3 py-1.5 font-medium hover:bg-white"
          >
            Compose decision →
          </button>
        </div>
      )}

      {composing && (
        <ComposeDecisionModal
          roomId={roomId}
          selected={selectedIntents}
          onRemove={removeFromCompose}
          onClose={() => setComposing(false)}
          onSubmitted={onComposeSubmitted}
        />
      )}
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

function DetectionList({
  intents,
  selectedIds,
  onToggle,
  onIgnore,
  isHost,
}: {
  intents: DetectedIntent[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onIgnore: (id: string) => void;
  isHost: boolean;
}) {
  if (intents.length === 0) {
    return (
      <Empty>
        Detections appear as participants speak. Check the ones you want, then
        compose a decision.
      </Empty>
    );
  }
  return (
    <ul className="divide-y divide-neutral-900">
      {intents.map((intent) => {
        const checked = selectedIds.has(intent.id);
        return (
          <li
            key={intent.id}
            className={`px-3 py-2.5 flex items-start gap-2 transition-colors ${
              checked ? 'bg-neutral-900/60' : 'hover:bg-neutral-950'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={!isHost}
              onChange={() => onToggle(intent.id)}
              className="mt-1 accent-neutral-100 disabled:cursor-not-allowed"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <TypeBadge type={intent.type} />
                <span className="text-[11px] text-neutral-500">
                  {intent.speakerName} · {(intent.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="text-sm text-neutral-200 leading-snug">{intent.summary}</div>
              <div className="text-xs text-neutral-600 mt-1 italic leading-snug">
                "{intent.rawText}"
              </div>
            </div>
            {isHost && (
              <button
                onClick={() => onIgnore(intent.id)}
                title="Remove from context"
                className="text-neutral-600 hover:text-red-400 text-base leading-none w-5 h-5 flex items-center justify-center"
              >
                ×
              </button>
            )}
          </li>
        );
      })}
    </ul>
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
