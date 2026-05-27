'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Zap, Check, X, AlertTriangle, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import type { LiveTask } from '../types';

type Props = {
  tasks: LiveTask[];
  isHost: boolean;
};

// Cards auto-dismiss this many ms after task ends (complete/failed/cancelled)
const AUTO_DISMISS_MS = 3000;

export function BuildingStack({ tasks, isHost }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());

  // Schedule auto-dismiss for finished tasks. Paused while showAll is true
  // so the history panel doesn't lose entries the user is reading.
  useEffect(() => {
    if (showAll) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const t of tasks) {
      if (t.status !== 'complete' && t.status !== 'failed' && t.status !== 'cancelled') continue;
      if (dismissed.has(t.id)) continue;
      timers.push(
        setTimeout(() => {
          setDismissed((prev) => new Set(prev).add(t.id));
        }, AUTO_DISMISS_MS),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [tasks, dismissed, showAll]);

  // When showAll → every task. Otherwise → queued/running + recently-finished
  const visible = showAll
    ? tasks
    : tasks.filter((t) => {
        if (t.status === 'queued' || t.status === 'running') return true;
        return !dismissed.has(t.id);
      });

  const hasActive = tasks.some((t) => t.status === 'queued' || t.status === 'running');

  async function cancelTask(task: LiveTask) {
    const isRunning = task.status === 'running';
    const msg = isRunning
      ? 'Stop this running task? Any files the agent has written will be rolled back to the last saved version.'
      : 'Cancel this queued task?';
    if (!confirm(msg)) return;
    setCancellingIds((prev) => new Set(prev).add(task.id));
    try {
      const res = await fetch(`/api/tasks/${task.id}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `cancel failed (${res.status})`);
      }
      toast.success(isRunning ? 'Task stopped · rolling back' : 'Task cancelled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'cancel failed');
    } finally {
      setCancellingIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  }

  // If nothing to show and no history button needed, render nothing
  if (visible.length === 0 && tasks.length === 0) return null;

  return (
    <div className="hidden md:flex absolute right-5 top-24 z-30 w-[320px] pointer-events-none flex-col gap-2">
      {/* History toggle — always visible when any tasks exist */}
      {tasks.length > 0 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="pointer-events-auto self-end flex items-center gap-2 rounded-full border border-white/10 bg-black/10 backdrop-blur-2xl px-3 py-1.5 text-xs text-white/65 hover:text-white hover:bg-black/30 shadow-2xl transition-colors"
          title={showAll ? 'Hide history' : 'Show all tasks'}
        >
          <ListChecks size={14} strokeWidth={2.2} />
          {showAll ? 'Hide' : `${tasks.length}`}
          {hasActive && !showAll && (
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
          )}
        </button>
      )}

      {/* Scrollable list when showAll, otherwise just stacked transient cards */}
      <div
        className={`pointer-events-auto flex flex-col gap-2 ${
          showAll ? 'max-h-[60vh] overflow-y-auto pr-1' : ''
        }`}
      >
        <AnimatePresence>
          {visible.map((task) => (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 16, scale: 0.96, transition: { duration: 0.3 } }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            >
              <TaskCard
                task={task}
                onCancel={isHost ? () => cancelTask(task) : undefined}
                cancelling={cancellingIds.has(task.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  onCancel,
  cancelling,
}: {
  task: LiveTask;
  onCancel?: () => void;
  cancelling: boolean;
}) {
  const isLive = task.status === 'running';
  const isDone = task.status === 'complete';
  const isFailed = task.status === 'failed';
  const isCancelled = task.status === 'cancelled';
  const isQueued = task.status === 'queued';

  const accentText =
    isFailed || isCancelled
      ? 'text-white/70'
      : isDone
      ? 'text-emerald-200'
      : 'text-white/80';

  return (
    <div className="rounded-2xl border border-white/10 bg-black/85 backdrop-blur-2xl p-3.5 shadow-2xl">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${accentText}`}>
          {isDone ? (
            <Check size={14} />
          ) : isFailed ? (
            <AlertTriangle size={14} />
          ) : (
            <Zap size={isLive ? 14 : 12} className={isLive ? 'animate-pulse' : ''} />
          )}
          <span className="capitalize">
            {isLive
              ? 'Building'
              : isQueued
              ? 'Queued'
              : isDone
              ? 'Done'
              : isCancelled
              ? 'Cancelled'
              : 'Failed'}
          </span>
        </div>
        {onCancel && (isQueued || isLive) && (
          <button
            onClick={onCancel}
            disabled={cancelling}
            title={isLive ? 'Stop and roll back' : 'Cancel'}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-white/70 hover:bg-red-500/80 hover:text-white disabled:opacity-50 transition-colors"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        )}
      </div>
      <div className="text-sm text-white/85 leading-snug line-clamp-2">{task.instruction}</div>
      {isLive && task.events.length > 0 && (
        <div className="mt-2 text-[11px] text-white/45 leading-snug truncate">
          {formatLastEvent(task.events[task.events.length - 1])}
        </div>
      )}
      {isDone && task.summary && (
        <div className="mt-1.5 text-[11px] italic text-white/45 leading-snug line-clamp-2">
          {task.summary}
        </div>
      )}
      {isFailed && task.error && (
        <div className="mt-1.5 text-[11px] text-red-300/80 leading-snug line-clamp-2">
          {task.error}
        </div>
      )}
    </div>
  );
}

function formatLastEvent(ev: LiveTask['events'][number]): string {
  if (ev.kind === 'tool_call') {
    const data = ev.data as Record<string, unknown> | undefined;
    if (ev.toolName === 'write_file' && data) return `→ write ${data.path}`;
    if (ev.toolName === 'read_file' && data) return `→ read ${data.path}`;
    if (ev.toolName === 'list_files' && data) return `→ ls ${data.directory ?? '.'}`;
    if (ev.toolName === 'install_packages' && data) return `→ npm i ${(data.packages as string[])?.join(' ') ?? ''}`;
    if (ev.toolName === 'run_command' && data) return `→ $ ${data.command}`;
    return `→ ${ev.toolName ?? 'tool'}`;
  }
  if (ev.kind === 'text') return ev.text ?? '';
  return ev.text ?? '';
}
