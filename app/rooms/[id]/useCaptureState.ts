'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDataChannel, useLocalParticipant } from '@livekit/components-react';
import { FEED_TOPIC, type FeedMessage } from './types';

type CaptureState = 'listening' | 'paused';

/**
 * Source of truth for the room's mic→AI capture toggle.
 *
 * - Initial value comes from server-side render (rooms.captureState).
 * - When the host toggles, we POST /api/rooms/[id]/capture and broadcast
 *   the new value over the FEED_TOPIC data channel so other participants
 *   update instantly.
 * - When we receive a capture_state message from another participant
 *   (i.e. the host on someone else's screen), we update local state.
 */
export function useCaptureState(roomId: string, initial: CaptureState) {
  const [state, setState] = useState<CaptureState>(initial);
  const stateRef = useRef<CaptureState>(initial);
  stateRef.current = state;
  const { localParticipant } = useLocalParticipant();

  // Listen for capture_state messages from other participants.
  useDataChannel(FEED_TOPIC, (msg) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const parsed = JSON.parse(text) as FeedMessage;
      if (parsed.kind === 'capture_state') {
        if (parsed.payload.state !== stateRef.current) {
          setState(parsed.payload.state);
        }
      }
    } catch {
      // ignore — other handlers already log bad messages
    }
  });

  // Refresh from server when the tab regains focus, in case a data-channel
  // broadcast was missed while backgrounded.
  useEffect(() => {
    function refresh() {
      fetch(`/api/rooms/${roomId}/capture`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j?.state && j.state !== stateRef.current) {
            setState(j.state as CaptureState);
          }
        })
        .catch(() => {});
    }
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [roomId]);

  // Host-only toggle. Updates DB, then broadcasts so peers update without
  // waiting for their own server roundtrip.
  const toggle = useCallback(
    async (next: CaptureState) => {
      // Optimistic local update so the pill flips immediately.
      setState(next);
      const res = await fetch(`/api/rooms/${roomId}/capture`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: next }),
      });
      if (!res.ok) {
        // Roll back if the server rejected us.
        setState(stateRef.current);
        return;
      }
      // Broadcast to peers over data channel.
      if (localParticipant) {
        const msg: FeedMessage = { kind: 'capture_state', payload: { state: next } };
        const encoder = new TextEncoder();
        try {
          await localParticipant.publishData(encoder.encode(JSON.stringify(msg)), {
            topic: FEED_TOPIC,
            reliable: true,
          });
        } catch (err) {
          // Best-effort — server state is already correct, peers will
          // pick up the change via the next /feed?meta=1 refresh.
          console.warn('[capture] publishData failed:', err);
        }
      }
    },
    [roomId, localParticipant],
  );

  return { state, toggle };
}
