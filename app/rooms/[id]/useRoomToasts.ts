'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { LiveTask, LiveVersion } from './types';

type Props = {
  tasks: LiveTask[];
  versions: LiveVersion[];
};

// Watch task + version state for transitions and fire toasts on the
// transitions that matter (task complete/failed, new version saved). Uses
// refs to remember previous state so we only toast on actual change, not
// every render.
export function useRoomToasts({ tasks, versions }: Props) {
  const prevTaskStatusRef = useRef<Map<string, LiveTask['status']>>(new Map());
  const prevVersionIdsRef = useRef<Set<string>>(new Set());
  const firstRunRef = useRef(true);

  // Tasks: detect status transitions
  useEffect(() => {
    const prev = prevTaskStatusRef.current;
    const next = new Map<string, LiveTask['status']>();
    for (const t of tasks) {
      next.set(t.id, t.status);
      if (firstRunRef.current) continue;
      const prevStatus = prev.get(t.id);
      if (prevStatus === t.status) continue;

      if (t.status === 'running' && prevStatus === 'queued') {
        toast.info(`Building: ${truncate(t.instruction, 50)}`);
      } else if (t.status === 'complete' && prevStatus !== 'complete') {
        toast.success('Task complete', {
          description: t.summary ? truncate(t.summary, 80) : truncate(t.instruction, 80),
        });
      } else if (t.status === 'failed' && prevStatus !== 'failed') {
        toast.error('Task failed', {
          description: t.error ? truncate(t.error, 120) : 'See Tasks drawer for details.',
        });
      }
    }
    prevTaskStatusRef.current = next;
  }, [tasks]);

  // Versions: detect newly added (excluding initial mount)
  useEffect(() => {
    const prev = prevVersionIdsRef.current;
    const next = new Set(versions.map((v) => v.id));
    if (!firstRunRef.current) {
      for (const v of versions) {
        if (prev.has(v.id)) continue;
        // Skip v0 since it's the initial template, not user-triggered
        if (v.versionNumber === 0) continue;
        if (v.rolledBackFromVersionId) {
          toast.success(`Rolled back · v${v.versionNumber}`, {
            description: truncate(v.summary, 80),
          });
        } else {
          toast.message(`Version v${v.versionNumber} saved`, {
            description: truncate(v.summary, 80),
          });
        }
      }
    }
    prevVersionIdsRef.current = next;
  }, [versions]);

  // First run done after effects ran once
  useEffect(() => {
    firstRunRef.current = false;
  }, []);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trim() + '…';
}
