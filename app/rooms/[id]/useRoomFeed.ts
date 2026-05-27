'use client';

import { useCallback, useEffect, useReducer } from 'react';
import { useDataChannel } from '@livekit/components-react';
import { FEED_TOPIC, type FeedMessage, type LiveTask, type LiveVersion, type RoomFeed } from './types';
import type { DetectedIntent, TranscriptSegment } from '@/lib/db/mongo';

type State = {
  transcripts: TranscriptSegment[];
  intents: DetectedIntent[];
  tasks: LiveTask[];
  versions: LiveVersion[];
};

type Action =
  | { type: 'transcript'; payload: TranscriptSegment }
  | { type: 'intent'; payload: DetectedIntent }
  | { type: 'task_started'; payload: Extract<FeedMessage, { kind: 'task_started' }>['payload'] }
  | { type: 'task_event'; payload: Extract<FeedMessage, { kind: 'task_event' }>['payload'] }
  | { type: 'task_complete'; payload: Extract<FeedMessage, { kind: 'task_complete' }>['payload'] }
  | { type: 'task_failed'; payload: Extract<FeedMessage, { kind: 'task_failed' }>['payload'] }
  | { type: 'replace_feed'; payload: { transcripts: TranscriptSegment[]; intents: DetectedIntent[] } }
  | { type: 'replace_tasks'; payload: LiveTask[] }
  | { type: 'replace_versions'; payload: LiveVersion[] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'transcript': {
      if (state.transcripts.some((t) => t.id === action.payload.id)) return state;
      return { ...state, transcripts: [...state.transcripts, action.payload] };
    }
    case 'intent': {
      if (state.intents.some((i) => i.id === action.payload.id)) {
        // Already present — patch status if it changed.
        return {
          ...state,
          intents: state.intents.map((i) =>
            i.id === action.payload.id ? { ...i, ...action.payload } : i,
          ),
        };
      }
      return { ...state, intents: [action.payload, ...state.intents] };
    }
    case 'task_started': {
      if (state.tasks.some((t) => t.id === action.payload.taskId)) return state;
      const t: LiveTask = {
        id: action.payload.taskId,
        intentId: action.payload.intentId,
        instruction: action.payload.instruction,
        status: 'running',
        model: action.payload.model,
        events: [],
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
      };
      return { ...state, tasks: [t, ...state.tasks] };
    }
    case 'task_event': {
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.taskId
            ? { ...t, events: [...t.events, action.payload.event] }
            : t,
        ),
      };
    }
    case 'task_complete': {
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.taskId
            ? { ...t, status: 'complete', summary: action.payload.summary }
            : t,
        ),
      };
    }
    case 'task_failed': {
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.taskId
            ? { ...t, status: 'failed', error: action.payload.error }
            : t,
        ),
      };
    }
    case 'replace_feed':
      return {
        ...state,
        transcripts: action.payload.transcripts,
        intents: action.payload.intents,
      };
    case 'replace_tasks':
      return { ...state, tasks: action.payload };
    case 'replace_versions':
      return { ...state, versions: action.payload };
  }
}

/**
 * Hook that combines the server-provided initial feed with live updates
 * coming over the LiveKit data channel. Returns the live state plus an
 * `updateIntent` helper for the host's Apply/Ignore controls.
 */
export function useRoomFeed(initial: RoomFeed, roomId: string) {
  const [state, dispatch] = useReducer(reducer, {
    transcripts: initial.transcripts,
    intents: initial.intents,
    tasks: initial.tasks ?? [],
    versions: initial.versions ?? [],
  });

  // Subscribe to data channel messages — from other participants AND from
  // the server-side execution agent (livekit-publish.ts).
  useDataChannel(FEED_TOPIC, (msg) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const parsed = JSON.parse(text) as FeedMessage;
      switch (parsed.kind) {
        case 'transcript':
          dispatch({ type: 'transcript', payload: parsed.payload });
          break;
        case 'intent':
          dispatch({ type: 'intent', payload: parsed.payload });
          break;
        case 'task_started':
          dispatch({ type: 'task_started', payload: parsed.payload });
          break;
        case 'task_event':
          dispatch({ type: 'task_event', payload: parsed.payload });
          break;
        case 'task_complete':
          dispatch({ type: 'task_complete', payload: parsed.payload });
          break;
        case 'task_failed':
          dispatch({ type: 'task_failed', payload: parsed.payload });
          break;
      }
    } catch (err) {
      console.error('[feed] bad data message:', err);
    }
  });

  // Slow polling for transcripts + intents (15s) — self-heal if data channel
  // messages got dropped while a tab was backgrounded.
  useEffect(() => {
    let cancelled = false;
    const i = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/feed`);
        if (!res.ok) return;
        const fresh = (await res.json()) as RoomFeed;
        if (!cancelled) {
          dispatch({
            type: 'replace_feed',
            payload: { transcripts: fresh.transcripts, intents: fresh.intents },
          });
        }
      } catch {
        // ignore network blips
      }
    }, 15_000);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
  }, [roomId]);

  // Fast polling for tasks (1s while any task is active, 5s otherwise).
  // Polling is the authoritative path now since LiveKit Cloud's sendData API
  // rejects server-side publish for rooms with only WebRTC participants.
  const hasActive = state.tasks.some(
    (t) => t.status === 'queued' || t.status === 'running',
  );
  useEffect(() => {
    let cancelled = false;
    const intervalMs = hasActive ? 1_000 : 5_000;
    const tick = async () => {
      try {
        const [tasksRes, versionsRes] = await Promise.all([
          fetch(`/api/rooms/${roomId}/tasks`),
          fetch(`/api/rooms/${roomId}/versions`),
        ]);
        if (!cancelled && tasksRes.ok) {
          const { tasks } = (await tasksRes.json()) as { tasks: LiveTask[] };
          dispatch({ type: 'replace_tasks', payload: tasks });
        }
        if (!cancelled && versionsRes.ok) {
          const { versions } = (await versionsRes.json()) as { versions: LiveVersion[] };
          dispatch({ type: 'replace_versions', payload: versions });
        }
      } catch {
        // ignore
      }
    };
    tick();
    const i = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
  }, [roomId, hasActive]);

  const updateIntent = useCallback(
    async (
      intentId: string,
      patch: { status: DetectedIntent['status'] },
    ) => {
      const res = await fetch(`/api/intents/${intentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return;
      const updated = (await res.json()) as DetectedIntent;
      dispatch({ type: 'intent', payload: updated });
    },
    [],
  );

  // Locally-originated events bypass the data channel (LiveKit doesn't echo
  // to the sender), so useBrowserSTT calls these directly to update the
  // speaker's own UI immediately.
  const addLocalTranscript = useCallback((segment: TranscriptSegment) => {
    dispatch({ type: 'transcript', payload: segment });
  }, []);

  const addLocalIntent = useCallback((intent: DetectedIntent) => {
    dispatch({ type: 'intent', payload: intent });
  }, []);

  // Counter that ticks up every time another task transitions into
  // 'complete'. Used by LiveRoomClient to force-reload the preview iframe.
  // Counting works where lastCompletedTaskId didn't — find() returns the
  // first completed task, which never changes after the first one, so
  // subsequent completions wouldn't bump the iframe key.
  const completedTaskCount = state.tasks.filter((t) => t.status === 'complete').length;

  return {
    feed: state,
    updateIntent,
    addLocalTranscript,
    addLocalIntent,
    completedTaskCount,
  };
}
