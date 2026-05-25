'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DetectedIntent } from '@/lib/db/mongo';
import { useSettings } from './useSettings';

// A detection moves through three states:
//
//   pending   — just arrived; in a soft-confirm countdown. User can click X
//               to throw it out. After `countdownMs` it auto-moves to pool.
//   pool      — survived the countdown; accumulating toward the threshold.
//               User can still expand the pool and X individual items.
//   composed  — pool hit the threshold; we POST /api/decisions/compose,
//               the intents drop out of `intents` (server marks 'applied'),
//               and the pool clears.
//
// Pending and pool live entirely in client memory. The server-side intent
// status doesn't change until the user explicitly ignores it OR the pool
// auto-composes (at which point the server bulk-marks 'applied').

type PendingItem = {
  intent: DetectedIntent;
  enqueuedAt: number; // ms
  expiresAt: number;  // ms
};

type Options = {
  roomId: string;
  intents: DetectedIntent[];
  isHost: boolean;
  onIgnoreIntent: (intentId: string) => void;
  onPoolComposed: () => void; // hook for UI side effects (e.g. switch tab)
};

// Intent types that should NOT enter the compose flow.
function isComposeCandidate(intent: DetectedIntent): boolean {
  if (intent.status !== 'pending_approval') return false;
  if (intent.type === 'noise') return false;
  if (intent.type === 'open_question') return false;
  return true;
}

export function useAutoCompose({
  roomId,
  intents,
  isHost,
  onIgnoreIntent,
  onPoolComposed,
}: Options) {
  const { settings } = useSettings();
  const { autoComposeThreshold, countdownMs } = settings;

  // Track which intent IDs we've already started a countdown for (or finished).
  // Without this, new intents arriving on every poll cycle would re-enter
  // pending repeatedly.
  const seenRef = useRef<Set<string>>(new Set());

  const [pending, setPending] = useState<PendingItem[]>([]);
  const [pool, setPool] = useState<DetectedIntent[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [composing, setComposing] = useState(false);

  // Drive the per-second countdown by ticking `now`.
  useEffect(() => {
    if (pending.length === 0) return;
    const i = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(i);
  }, [pending.length]);

  // Pick up new compose-candidate intents from the feed and put them into
  // pending with a fresh expiry.
  useEffect(() => {
    if (!isHost) return;
    const fresh: PendingItem[] = [];
    for (const intent of intents) {
      if (seenRef.current.has(intent.id)) continue;
      if (!isComposeCandidate(intent)) {
        seenRef.current.add(intent.id);
        continue;
      }
      seenRef.current.add(intent.id);
      const enqueuedAt = Date.now();
      fresh.push({
        intent,
        enqueuedAt,
        expiresAt: enqueuedAt + countdownMs,
      });
    }
    if (fresh.length > 0) {
      setPending((p) => [...fresh, ...p]); // newest on top
    }
  }, [intents, isHost, countdownMs]);

  // Expire pending items whose countdown elapsed — move them into the pool.
  useEffect(() => {
    if (pending.length === 0) return;
    const expired = pending.filter((p) => p.expiresAt <= now);
    if (expired.length === 0) return;
    setPending((prev) => prev.filter((p) => p.expiresAt > now));
    setPool((prev) => {
      const ids = new Set(prev.map((i) => i.id));
      const additions = expired
        .map((e) => e.intent)
        .filter((i) => !ids.has(i.id));
      return [...prev, ...additions];
    });
  }, [now, pending]);

  // When the pool hits the threshold, fire compose.
  useEffect(() => {
    if (!isHost) return;
    if (pool.length < autoComposeThreshold) return;
    if (composing) return;

    setComposing(true);
    const intentIds = pool.map((i) => i.id);
    (async () => {
      try {
        // Ask the AI for a merged instruction first.
        const composeRes = await fetch('/api/intel/compose-decision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, intentIds }),
        });
        if (!composeRes.ok) {
          const data = await composeRes.json().catch(() => ({}));
          throw new Error(data.error ?? `compose-decision failed`);
        }
        const { instruction } = (await composeRes.json()) as { instruction: string };

        // Submit the decision → backend creates Task + marks intents 'applied'.
        const submitRes = await fetch('/api/decisions/compose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, intentIds, instruction }),
        });
        if (!submitRes.ok) {
          const data = await submitRes.json().catch(() => ({}));
          throw new Error(data.error ?? `decisions/compose failed`);
        }
      } catch (err) {
        console.error('[auto-compose] failed:', err);
        // Leave pool intact so user can manually retry / inspect.
        setComposing(false);
        return;
      }
      // Clear pool — server marks intents 'applied' so they'll drop out of
      // the next /api/rooms/[id]/feed poll automatically too.
      setPool([]);
      setComposing(false);
      onPoolComposed();
    })();
  }, [pool, autoComposeThreshold, composing, roomId, isHost, onPoolComposed]);

  const removePending = useCallback(
    (intentId: string) => {
      setPending((prev) => prev.filter((p) => p.intent.id !== intentId));
      onIgnoreIntent(intentId);
    },
    [onIgnoreIntent],
  );

  const removeFromPool = useCallback(
    (intentId: string) => {
      setPool((prev) => prev.filter((i) => i.id !== intentId));
      onIgnoreIntent(intentId);
    },
    [onIgnoreIntent],
  );

  // Drop pool members that the server tells us got ignored elsewhere.
  useEffect(() => {
    setPool((prev) => prev.filter((i) => {
      const fresh = intents.find((x) => x.id === i.id);
      return !fresh || fresh.status === 'pending_approval';
    }));
  }, [intents]);

  const visibleCountdowns = useMemo(
    () =>
      pending.map((p) => ({
        intent: p.intent,
        msLeft: Math.max(0, p.expiresAt - now),
        progress: Math.max(0, Math.min(1, (p.expiresAt - now) / countdownMs)),
      })),
    [pending, now, countdownMs],
  );

  return {
    pending: visibleCountdowns,
    pool,
    composing,
    threshold: autoComposeThreshold,
    removePending,
    removeFromPool,
  };
}
