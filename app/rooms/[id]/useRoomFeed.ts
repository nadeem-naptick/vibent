'use client';

import { useCallback, useEffect, useReducer } from 'react';
import { useDataChannel } from '@livekit/components-react';
import { FEED_TOPIC, type FeedMessage, type LiveTask, type RoomFeed } from './types';
import type { DetectedIntent, TranscriptSegment } from '@/lib/db/mongo';

type State = {
  transcripts: TranscriptSegment[];
  intents: DetectedIntent[];
  tasks: LiveTask[];
};

type Action =
  | { type: 'transcript'; payload: TranscriptSegment }
  | { type: 'intent'; payload: DetectedIntent }
  | { type: 'task_started'; payload: Extract<FeedMessage, { kind: 'task_started' }>['payload'] }
  | { type: 'task_event'; payload: Extract<FeedMessage, { kind: 'task_event' }>['payload'] }
  | { type: 'task_complete'; payload: Extract<FeedMessage, { kind: 'task_complete' }>['payload'] }
  | { type: 'task_failed'; payload: Extract<FeedMessage, { kind: 'task_failed' }>['payload'] }
  | { type: 'replace'; payload: State };

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
    case 'replace':
      return action.payload;
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

  // Polling fallback — useful before LiveKit connects and as a self-heal in
  // case data channel messages get dropped while a tab is backgrounded.
  useEffect(() => {
    let cancelled = false;
    const i = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/feed`);
        if (!res.ok) return;
        const fresh = (await res.json()) as RoomFeed;
        if (!cancelled) {
          dispatch({
            type: 'replace',
            payload: {
              transcripts: fresh.transcripts,
              intents: fresh.intents,
              tasks: fresh.tasks ?? [],
            },
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

  // Helper for components that want to know when any task completes, so they
  // can do side effects (e.g. force-refresh the preview iframe).
  const lastCompletedTaskId =
    state.tasks.find((t) => t.status === 'complete')?.id ?? null;

  return {
    feed: state,
    updateIntent,
    addLocalTranscript,
    addLocalIntent,
    lastCompletedTaskId,
  };
}
