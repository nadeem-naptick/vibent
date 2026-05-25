'use client';

import { useCallback, useEffect, useReducer } from 'react';
import { useDataChannel } from '@livekit/components-react';
import { FEED_TOPIC, type FeedMessage, type RoomFeed } from './types';
import type { DetectedIntent, TranscriptSegment } from '@/lib/db/mongo';

type State = {
  transcripts: TranscriptSegment[];
  intents: DetectedIntent[];
};

type Action =
  | { type: 'transcript'; payload: TranscriptSegment }
  | { type: 'intent'; payload: DetectedIntent }
  | { type: 'replace'; payload: State };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'transcript': {
      // De-dupe by id; otherwise insert chronologically at the end.
      if (state.transcripts.some((t) => t.id === action.payload.id)) return state;
      return { ...state, transcripts: [...state.transcripts, action.payload] };
    }
    case 'intent': {
      if (state.intents.some((i) => i.id === action.payload.id)) return state;
      // Newest intents at the top.
      return { ...state, intents: [action.payload, ...state.intents] };
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
  const [state, dispatch] = useReducer(reducer, initial);

  // Subscribe to data channel messages from other participants
  useDataChannel(FEED_TOPIC, (msg) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const parsed = JSON.parse(text) as FeedMessage;
      if (parsed.kind === 'transcript') {
        dispatch({ type: 'transcript', payload: parsed.payload });
      } else if (parsed.kind === 'intent') {
        dispatch({ type: 'intent', payload: parsed.payload });
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
        if (!cancelled) dispatch({ type: 'replace', payload: fresh });
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

  return { feed: state, updateIntent };
}
