'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Radio } from 'lucide-react';
import {
  useParticipants,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import type { Participant } from 'livekit-client';

const GRADIENTS = [
  'bg-gradient-to-br from-blue-950 via-blue-700 to-slate-950',
  'bg-gradient-to-br from-amber-950 via-stone-800 to-slate-950',
  'bg-gradient-to-br from-sky-950 via-slate-800 to-slate-950',
  'bg-gradient-to-br from-indigo-950 via-zinc-800 to-slate-950',
  'bg-gradient-to-br from-slate-950 via-neutral-800 to-slate-950',
  'bg-gradient-to-br from-purple-950 via-purple-800 to-slate-950',
  'bg-gradient-to-br from-emerald-950 via-emerald-800 to-slate-950',
];

export function ParticipantDock() {
  const participants = useParticipants();
  if (participants.length === 0) return null;

  return (
    <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-end gap-3 rounded-[28px] border border-white/15 bg-slate-950/70 p-2.5 shadow-2xl backdrop-blur-2xl max-w-[calc(100vw-40px)] overflow-x-auto">
      {participants.map((p, index) => (
        <ParticipantTile key={p.identity} participant={p} index={index} />
      ))}
    </div>
  );
}

function ParticipantTile({ participant, index }: { participant: Participant; index: number }) {
  // Subscribe to this participant's camera track (if any) so we render the
  // actual video feed when their camera is on.
  const trackRefs = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: false },
  );
  const cameraTrackRef = trackRefs.find(
    (t) => t.participant.identity === participant.identity,
  );
  const cameraTrack = cameraTrackRef?.publication ? cameraTrackRef : undefined;
  const isSpeaking = participant.isSpeaking;
  const micEnabled = participant.isMicrophoneEnabled;
  const displayName = participant.name || participant.identity;

  // Poll audioLevel for a smooth-ish VU bar. LiveKit updates this in real
  // time via internal listeners — we mirror into state so the bar re-renders.
  const [audioLevel, setAudioLevel] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setAudioLevel(participant.audioLevel ?? 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [participant]);

  return (
    <div className="group relative">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{
          opacity: 1,
          // Speaking participant subtly lifts above the rest
          y: isSpeaking ? -8 : 0,
        }}
        transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
        style={{ width: '160px', height: '100px' }}
        className={`relative overflow-hidden rounded-[20px] border transition-all duration-300 hover:!w-[240px] hover:!h-[150px] ${
          isSpeaking
            ? 'border-blue-400/80 shadow-[0_0_36px_rgba(79,140,255,.55)]'
            : 'border-white/15 shadow-2xl'
        } ${!micEnabled ? 'opacity-60 saturate-50' : ''}`}
      >
        {/* Video or gradient fallback */}
        {cameraTrack ? (
          <VideoTrack
            trackRef={cameraTrack as never}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <>
            <div className={`absolute inset-0 ${GRADIENTS[index % GRADIENTS.length]}`} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(255,255,255,.20),transparent_28%)]" />
            <div className="absolute left-1/2 top-1/3 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-lg font-semibold text-white ring-1 ring-white/20 transition-all group-hover:h-16 group-hover:w-16 group-hover:text-2xl">
              {displayName[0]?.toUpperCase() ?? '?'}
            </div>
          </>
        )}

        {/* Muted overlay icon — top-right, only when mic off */}
        {!micEnabled && (
          <div className="absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-black/60 backdrop-blur-sm">
            <MicOff size={12} className="text-red-300" />
          </div>
        )}

        {/* Name + status overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2.5 pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-white">{displayName}</div>
              <div className="truncate text-[10px] text-white/55">
                {participant.isLocal ? 'You' : 'Collaborator'}
              </div>
            </div>
            {isSpeaking ? (
              <Radio size={15} className="shrink-0 text-blue-200 animate-pulse" />
            ) : micEnabled ? (
              <Mic size={13} className="shrink-0 text-white/45" />
            ) : null}
          </div>

          {/* Audio level bar — only visible when mic on */}
          {micEnabled && (
            <div className="mt-1.5 h-0.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-100 ${
                  isSpeaking ? 'bg-blue-400' : 'bg-white/40'
                }`}
                style={{ width: `${Math.min(100, audioLevel * 200)}%` }}
              />
            </div>
          )}
        </div>

        {isSpeaking && (
          <div className="absolute inset-0 rounded-[20px] ring-2 ring-inset ring-blue-400/45 pointer-events-none" />
        )}
      </motion.div>
    </div>
  );
}
