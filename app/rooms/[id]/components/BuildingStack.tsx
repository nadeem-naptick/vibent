'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, X, Check } from 'lucide-react';
import type { LiveTask } from '../types';

type Props = {
  tasks: LiveTask[];
};

export function BuildingStack({ tasks }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Show only active (queued + running) plus most-recent completed at the
  // top. Older completed tasks live in the Active Tasks drawer.
  const active = tasks.filter(
    (t) => t.status === 'queued' || t.status === 'running',
  );
  const recentDone = tasks
    .filter((t) => t.status === 'complete' || t.status === 'failed')
    .slice(0, 2);
  const visible = [...active, ...recentDone];

  if (visible.length === 0) return null;

  return (
    <div className="absolute right-24 bottom-5 z-30 w-[310px] pointer-events-none">
      <div
        className="relative pointer-events-auto"
        style={{ height: expanded ? visible.length * 110 : 92 }}
      >
        {visible.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
            index={index}
            expanded={expanded}
            stackSize={visible.length}
            onToggle={() => setExpanded((v) => !v)}
          />
        ))}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  index,
  expanded,
  stackSize,
  onToggle,
}: {
  task: LiveTask;
  index: number;
  expanded: boolean;
  stackSize: number;
  onToggle: () => void;
}) {
  const progress = computeProgress(task);
  const isLive = task.status === 'running';
  const isDone = task.status === 'complete';
  const isFailed = task.status === 'failed';

  const borderColor = isFailed
    ? 'border-red-400/30'
    : isDone
    ? 'border-emerald-400/25'
    : 'border-blue-400/25';

  const accentText = isFailed
    ? 'text-red-200'
    : isDone
    ? 'text-emerald-100'
    : 'text-blue-100';

  const progressBar = isFailed
    ? 'bg-red-500'
    : isDone
    ? 'bg-emerald-500'
    : 'bg-blue-500';

  return (
    <motion.div
      animate={{
        y: expanded ? -index * 110 : -index * 10,
        scale: expanded ? 1 : 1 - index * 0.035,
        opacity: expanded ? 1 : 1 - index * 0.12,
        zIndex: stackSize - index,
      }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      onClick={onToggle}
      className={`absolute bottom-0 left-0 right-0 cursor-pointer rounded-[24px] border ${borderColor} bg-[#0B0F14]/88 p-4 shadow-2xl backdrop-blur-2xl`}
      style={{ zIndex: stackSize - index }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className={`flex items-center gap-2 text-sm font-semibold ${accentText}`}>
          {isDone ? <Check size={16} /> : <Zap size={isLive ? 16 : 14} className={isLive ? 'animate-pulse' : ''} />}
          <span className="capitalize">
            {task.status === 'running'
              ? 'Building'
              : task.status === 'queued'
              ? 'Queued'
              : task.status === 'complete'
              ? 'Done'
              : 'Failed'}
          </span>
        </div>
        <span className={`text-[10px] ${accentText}`}>
          {task.model?.split('/').pop() ?? ''}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs gap-3">
        <span className="text-white/58 truncate min-w-0">{task.instruction}</span>
        <span className={`${accentText} shrink-0 tabular-nums`}>{progress}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={`h-full rounded-full ${progressBar}`}
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
      {expanded && task.events.length > 0 && (
        <div className="mt-3 max-h-32 overflow-y-auto border-t border-white/5 pt-2">
          <ol className="space-y-0.5">
            {task.events.slice(-6).map((ev, i) => (
              <li key={i} className="text-[11px] text-white/45 truncate">
                {formatEvent(ev)}
              </li>
            ))}
          </ol>
        </div>
      )}
      {expanded && task.error && (
        <div className="mt-2 text-[11px] text-red-300 font-mono leading-snug">
          {task.error}
        </div>
      )}
    </motion.div>
  );
}

function computeProgress(task: LiveTask): number {
  if (task.status === 'complete') return 100;
  if (task.status === 'failed') return 100;
  if (task.status === 'queued') return 0;
  // Running — derive a fake-but-monotonic value from event count, capped at 90.
  const events = task.events?.length ?? 0;
  return Math.min(90, 12 + events * 4);
}

function formatEvent(ev: LiveTask['events'][number]): string {
  if (ev.kind === 'tool_call') {
    const data = ev.data as Record<string, unknown> | undefined;
    if (ev.toolName === 'write_file' && data) return `write ${data.path}`;
    if (ev.toolName === 'read_file' && data) return `read ${data.path}`;
    if (ev.toolName === 'list_files' && data) return `ls ${data.directory ?? '.'}`;
    if (ev.toolName === 'install_packages' && data) return `npm i ${(data.packages as string[])?.join(' ') ?? ''}`;
    if (ev.toolName === 'run_command' && data) return `$ ${data.command}`;
    return ev.toolName ?? 'tool';
  }
  if (ev.kind === 'text') return ev.text ?? '';
  if (ev.kind === 'tool_result') {
    const data = ev.data as { ok?: boolean } | undefined;
    return `${ev.toolName} → ${data?.ok === false ? 'failed' : 'ok'}`;
  }
  return ev.text ?? 'event';
}
