'use client';

import { useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { HelpTooltip } from './HelpTooltip';

type Props = {
  state: 'listening' | 'paused';
  isHost: boolean;
  onToggle: (next: 'listening' | 'paused') => Promise<void> | void;
};

// Top-right pill showing whether the room's mic→AI pipeline is live.
// Host can click to toggle; non-hosts see a read-only indicator so they
// know whether the room is capturing them right now.
export function CaptureToggle({ state, isHost, onToggle }: Props) {
  const [busy, setBusy] = useState(false);
  const listening = state === 'listening';

  async function handleClick() {
    if (!isHost || busy) return;
    setBusy(true);
    try {
      await onToggle(listening ? 'paused' : 'listening');
    } finally {
      setBusy(false);
    }
  }

  const label = listening ? 'Vibe on' : 'Vibe off';
  const body = listening
    ? 'AI is capturing this room — voice → transcripts → intents → decisions → tasks. Click to go off the record so the team can chat privately. Anything already in the queue keeps running.'
    : 'Capture is paused — the conversation stays between humans. Click to resume so the AI can start picking up intents and proposing decisions again.';

  return (
    <HelpTooltip label={label} body={body}>
      <button
        type="button"
        onClick={handleClick}
        disabled={!isHost || busy}
        aria-label={label}
        className={[
          'relative inline-flex items-center justify-center rounded-full border h-[56px] md:h-[67px] w-[56px] md:w-[67px]',
          'shrink-0 transition-colors shadow-2xl backdrop-blur-2xl',
          listening
            ? 'border-white/10 bg-slate-900/85 text-white/85 hover:bg-slate-800 hover:text-white'
            : 'border-white/10 bg-slate-900/85 text-white/45 hover:bg-slate-800 hover:text-white/65',
          isHost ? 'cursor-pointer' : 'cursor-default opacity-90',
          busy ? 'opacity-70' : '',
        ].join(' ')}
      >
        {listening ? (
          <>
            <Play size={24} strokeWidth={2} fill="currentColor" />
            {/* Pulsing red dot in the corner = recording indicator */}
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
          </>
        ) : (
          <Pause size={24} strokeWidth={2} fill="currentColor" />
        )}
      </button>
    </HelpTooltip>
  );
}
