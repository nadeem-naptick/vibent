'use client';

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
    <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-end gap-3 rounded-[30px] border border-white/10 bg-slate-950/42 p-2 shadow-2xl backdrop-blur-2xl max-w-[calc(100vw-40px)] overflow-x-auto">
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
  // Only treat as a real track if it has a publication (vs placeholder).
  const cameraTrack = cameraTrackRef?.publication ? cameraTrackRef : undefined;
  const isSpeaking = participant.isSpeaking;
  const micEnabled = participant.isMicrophoneEnabled;
  const displayName = participant.name || participant.identity;

  return (
    <div className="group relative">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={`relative h-24 w-36 overflow-hidden rounded-[24px] border transition-all duration-300 group-hover:h-36 group-hover:w-56 ${
          isSpeaking
            ? 'border-blue-400/70 shadow-[0_0_36px_rgba(79,140,255,.42)]'
            : 'border-white/12 shadow-2xl'
        }`}
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
            <div className="absolute left-1/2 top-5 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-white/18 text-lg font-semibold text-white ring-1 ring-white/15 group-hover:top-9 group-hover:h-16 group-hover:w-16 group-hover:text-2xl transition-all">
              {displayName[0]?.toUpperCase() ?? '?'}
            </div>
          </>
        )}

        {/* Name + status overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{displayName}</div>
              <div className="truncate text-[11px] text-white/50">
                {participant.isLocal ? 'You' : 'Collaborator'}
              </div>
            </div>
            {isSpeaking ? (
              <Radio size={15} className="shrink-0 text-blue-200" />
            ) : micEnabled ? (
              <Mic size={13} className="shrink-0 text-white/45" />
            ) : (
              <MicOff size={13} className="shrink-0 text-white/45" />
            )}
          </div>
        </div>

        {isSpeaking && (
          <div className="absolute inset-0 rounded-[24px] ring-2 ring-inset ring-blue-400/45 pointer-events-none" />
        )}
      </motion.div>
    </div>
  );
}
