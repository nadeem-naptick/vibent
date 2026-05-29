'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LiveTask } from '../types';
import { friendlyEventLabel } from '../taskEventLabels';
import { useTaskProgress } from '../useTaskProgress';

type Props = {
  // The room's currently-running task (or undefined if idle). When this
  // changes from undefined → defined the component fades in; from defined
  // → undefined it fades out (handled by the parent's AnimatePresence).
  task: LiveTask | undefined;
};

// Lives on the empty-state overlay (Canvas.tsx) and as an in-room pill
// when a task is mid-flight. Shows a rolling activity ticker — "Searching
// the web for X", "Drafting Hero.jsx", etc. — plus a thin progress bar.
//
// This is purely a presentational component reading from the latest event
// in task.events. The polling in useRoomFeed updates events at 1s while a
// task is active so the ticker refreshes smoothly.
export function LiveTaskActivity({ task }: Props) {
  const progress = useTaskProgress(task);
  const friendly = task ? friendlyEventLabel(progress.latestEvent) : null;

  // Cache the last friendly label so the ticker doesn't flicker when an
  // event we filter out (tool_result, empty text) arrives between useful
  // tool_call events.
  const [lastShown, setLastShown] = useState<typeof friendly>(null);
  useEffect(() => {
    if (friendly) setLastShown(friendly);
  }, [friendly?.text]);

  if (!task) return null;
  const phase = progress.phase;
  const label = friendly ?? lastShown;

  return (
    <div className="pointer-events-auto inline-flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-2xl shadow-xl min-w-[280px] max-w-[460px]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-white/55">
          {phase === 'skeleton' && 'Sketching the layout'}
          {phase === 'refinement' && 'Refining details'}
          {phase === 'finishing' && 'Finishing up'}
          {phase === 'queued' && 'Queued'}
          {phase === 'done' && 'Done'}
          {phase === 'failed' && 'Failed'}
        </div>
        <div className="text-[11px] tabular-nums font-semibold text-white/65">
          {progress.percent}%
        </div>
      </div>

      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-200 transition-[width] duration-500 ease-out"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="h-5 overflow-hidden">
        <AnimatePresence mode="wait">
          {label && (
            <motion.div
              key={label.text}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-1.5 text-sm text-white/85 leading-tight truncate"
            >
              <span>{label.icon}</span>
              <span className="truncate">{label.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
