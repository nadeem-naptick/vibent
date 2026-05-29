import { useEffect, useState } from 'react';
import type { LiveTask } from './types';

export type TaskPhase = 'queued' | 'skeleton' | 'refinement' | 'finishing' | 'done' | 'failed';

export type TaskProgress = {
  percent: number; // 0-100
  phase: TaskPhase;
  // Currently-running tool name (lowercased), or undefined when the agent
  // is between tools / thinking.
  currentTool: string | undefined;
  // Latest event for ticker display. Already-resolved tool_results are
  // skipped so we always show the most recent _in-flight_ action.
  latestEvent: LiveTask['events'][number] | undefined;
};

// Time budgets used for the implicit progress ramp when there are no
// explicit milestones to lean on. Each phase asymptotes near its cap so
// the bar never reaches 100% until the task actually completes.
const SKELETON_BUDGET_MS = 25_000;
const REFINEMENT_BUDGET_MS = 45_000;

function hasSkeletonCompleteEvent(task: LiveTask): boolean {
  return task.events.some(
    (e) => e.kind === 'tool_call' && e.toolName === 'mark_skeleton_complete',
  );
}

function elapsedSinceFirstEvent(task: LiveTask): number {
  // task.events are time-ordered. First event's ts marks when the agent
  // actually started thinking. If there are no events yet, fall back to
  // a 0 elapsed so the bar stays at "queued" until the agent moves.
  const firstTs = task.events[0]?.ts;
  if (!firstTs) return 0;
  return Date.now() - firstTs;
}

function lastInFlightEvent(task: LiveTask): LiveTask['events'][number] | undefined {
  // Prefer the most recent tool_call (the thing actually happening) over a
  // tool_result (which is "we just finished X").
  for (let i = task.events.length - 1; i >= 0; i--) {
    const e = task.events[i];
    if (e.kind === 'tool_call' || e.kind === 'text') return e;
  }
  return task.events[task.events.length - 1];
}

// Compute current progress for a task. Recomputes every 500ms while the
// task is running so the time-based ramp animates smoothly even when no
// new events arrive (the agent might think for 5-10s between tools).
export function useTaskProgress(task: LiveTask | undefined): TaskProgress {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!task) return;
    if (task.status !== 'running' && task.status !== 'queued') return;
    const i = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(i);
  }, [task?.id, task?.status]);

  if (!task) {
    return { percent: 0, phase: 'queued', currentTool: undefined, latestEvent: undefined };
  }

  if (task.status === 'complete') {
    return {
      percent: 100,
      phase: 'done',
      currentTool: undefined,
      latestEvent: task.events[task.events.length - 1],
    };
  }
  if (task.status === 'failed' || task.status === 'cancelled') {
    return {
      percent: 100,
      phase: 'failed',
      currentTool: undefined,
      latestEvent: task.events[task.events.length - 1],
    };
  }
  if (task.status === 'queued') {
    return { percent: 0, phase: 'queued', currentTool: undefined, latestEvent: undefined };
  }

  // Running.
  const latest = lastInFlightEvent(task);
  const currentTool =
    latest?.kind === 'tool_call' ? latest.toolName : undefined;
  const skeletonDone = hasSkeletonCompleteEvent(task);
  const elapsed = elapsedSinceFirstEvent(task);

  if (!skeletonDone) {
    // Phase 1: ramp 0 → 50 over the skeleton budget. Asymptote at 48% so
    // there's still room for the jump when the milestone fires.
    const ratio = Math.min(0.95, elapsed / SKELETON_BUDGET_MS);
    return {
      percent: Math.round(ratio * 50),
      phase: 'skeleton',
      currentTool,
      latestEvent: latest,
    };
  }

  // Phase 2: ramp 50 → 95 over the refinement budget. Asymptote at 93%
  // so completion gets to clearly snap to 100.
  const skeletonTs =
    task.events.find(
      (e) => e.kind === 'tool_call' && e.toolName === 'mark_skeleton_complete',
    )?.ts ?? task.events[0]?.ts ?? Date.now();
  const phase2Elapsed = Date.now() - skeletonTs;
  const ratio = Math.min(0.95, phase2Elapsed / REFINEMENT_BUDGET_MS);
  // Heuristic: if the latest event is check_preview, we're nearly done.
  const finishing = currentTool === 'check_preview';
  const percent = finishing
    ? Math.max(90, Math.round(50 + ratio * 45))
    : Math.round(50 + ratio * 43);
  return {
    percent,
    phase: finishing ? 'finishing' : 'refinement',
    currentTool,
    latestEvent: latest,
  };
}
