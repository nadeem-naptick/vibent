'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { TranscriptSegment } from '@/lib/db/mongo';

const CHECK_INTERVAL_MS = 30 * 1000; // 30 sec

type Opts = {
  isHost: boolean;
  captureState: 'listening' | 'paused';
  transcripts: TranscriptSegment[];
  // Minutes of silence before auto-pausing. 0 disables the auto-pause.
  idleMinutes: number;
  onAutoPause: () => Promise<void> | void;
};

/**
 * Auto-pause capture after 5 min with no transcripts.
 *
 * Only the host's browser runs the check — the API enforces host-only
 * toggling anyway, and we don't want N clients racing to pause. The host
 * shows a toast explaining why; other participants just see the pill flip
 * (same UX as a manual host pause).
 *
 * Resets on every new transcript and on manual toggle back to 'listening'.
 */
export function useIdleAutoPause({
  isHost,
  captureState,
  transcripts,
  idleMinutes,
  onAutoPause,
}: Opts) {
  const lastInputAtRef = useRef<number>(Date.now());

  // Refresh the timer baseline whenever a new transcript arrives or when
  // the user manually flips back to 'listening' (gives them a fresh window).
  useEffect(() => {
    lastInputAtRef.current = Date.now();
  }, [transcripts.length, captureState]);

  useEffect(() => {
    if (!isHost) return;
    if (captureState !== 'listening') return;
    if (idleMinutes <= 0) return; // user disabled the auto-pause

    const thresholdMs = idleMinutes * 60 * 1000;

    const interval = setInterval(async () => {
      const idleFor = Date.now() - lastInputAtRef.current;
      if (idleFor < thresholdMs) return;

      // Idle threshold crossed. Pause and notify the host. The data-channel
      // broadcast inside onAutoPause will flip the pill on all peers too.
      await onAutoPause();
      toast.info('Vibe off', {
        description: `No one spoke for ${idleMinutes} minute${idleMinutes === 1 ? '' : 's'} — capture is paused. Click the Vibe pill to resume.`,
        duration: 8000,
      });
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isHost, captureState, idleMinutes, onAutoPause]);
}
