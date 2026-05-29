'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PenLine,
  Brain,
  Radio,
  Monitor,
  Smartphone,
} from 'lucide-react';
import type { DeviceFrame } from '../useSettings';
import {
  useParticipants,
  useTrackToggle,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import type { Participant } from 'livekit-client';
import { PillButton } from './PillButton';
import { InviteTile } from './InviteTile';

const GRADIENTS = [
  'bg-gradient-to-br from-blue-950 via-blue-700 to-slate-950',
  'bg-gradient-to-br from-amber-950 via-stone-800 to-slate-950',
  'bg-gradient-to-br from-sky-950 via-slate-800 to-slate-950',
  'bg-gradient-to-br from-indigo-950 via-zinc-800 to-slate-950',
  'bg-gradient-to-br from-slate-950 via-neutral-800 to-slate-950',
  'bg-gradient-to-br from-purple-950 via-purple-800 to-slate-950',
  'bg-gradient-to-br from-emerald-950 via-emerald-800 to-slate-950',
];

type Props = {
  onEndCall: () => void;
  deviceFrame: DeviceFrame;
  onChangeDeviceFrame: (next: DeviceFrame) => void;
  // Opens the manual decision draft modal. Omitted for non-hosts so the
  // pill simply doesn't render.
  onDraftDecision?: () => void;
  // Brain (thinking mode) — host-only toggle that controls whether the
  // executor uses extended reasoning. Omitted for non-hosts.
  thinkingMode?: boolean;
  onToggleThinking?: () => void;
};

export function ParticipantDock({
  onEndCall,
  deviceFrame,
  onChangeDeviceFrame,
  onDraftDecision,
  thinkingMode,
  onToggleThinking,
}: Props) {
  const participants = useParticipants();

  return (
    <div
      className="absolute bottom-4 md:bottom-6 z-30 flex flex-col items-center gap-3 pointer-events-none"
      style={{
        left: '50%',
        transform: 'translateX(-50%)',
      }}
    >
      {/* Video tiles + invite slot — both float directly on the canvas.
          No grey pill container; each tile carries its own border + shadow.
          The Invite tile sits at the end of the row, same row height. */}
      <div className="pointer-events-auto flex items-end gap-2 md:gap-3 overflow-x-auto max-w-[calc(100vw-1.5rem)] md:max-w-[calc(100vw-200px)]">
        {participants.map((p, index) => (
          <ParticipantTile key={p.identity} participant={p} index={index} />
        ))}
        <InviteTile />
      </div>

      {/* Toolbar — mic, cam, device preview, end call */}
      <div className="pointer-events-auto">
        <ParticipantToolbar
          onEndCall={onEndCall}
          deviceFrame={deviceFrame}
          onChangeDeviceFrame={onChangeDeviceFrame}
          onDraftDecision={onDraftDecision}
          thinkingMode={thinkingMode}
          onToggleThinking={onToggleThinking}
        />
      </div>
    </div>
  );
}

function ParticipantToolbar({
  onEndCall,
  deviceFrame,
  onChangeDeviceFrame,
  onDraftDecision,
  thinkingMode,
  onToggleThinking,
}: {
  onEndCall: () => void;
  deviceFrame: DeviceFrame;
  onChangeDeviceFrame: (next: DeviceFrame) => void;
  onDraftDecision?: () => void;
  thinkingMode?: boolean;
  onToggleThinking?: () => void;
}) {
  // useTrackToggle subscribes to the underlying ParticipantEvent.Track* events
  // so the `enabled` flag stays in sync with the actual track state — unlike
  // a snapshot pulled into useState, which goes stale when LiveKit publishes
  // tracks asynchronously after first render.
  const { enabled: mic, toggle: toggleMic } = useTrackToggle({
    source: Track.Source.Microphone,
  });
  const { enabled: camera, toggle: toggleCamera } = useTrackToggle({
    source: Track.Source.Camera,
  });

  return (
    <>
      {/* Mobile: mic + cam + (draft if host) + end. Compact pills.
          Device frame toggle is desktop-only — overflows a phone-width
          viewport. Vibe pill lives in the top-left anchor. */}
      <div className="flex md:hidden items-center gap-2">
        <PillButton
          icon={mic ? Mic : MicOff}
          title={mic ? 'Mute mic' : 'Unmute mic'}
          helpBody="Mutes your microphone for other humans in the room. Separate from Vibe — even with your mic on, Vibe controls whether the AI listens."
          onClick={() => toggleMic()}
          variant={mic ? 'default' : 'danger'}
        />
        <PillButton
          icon={camera ? Video : VideoOff}
          title={camera ? 'Stop camera' : 'Start camera'}
          helpBody="Turns your camera feed on or off. Other participants only see your video when this is on."
          onClick={() => toggleCamera()}
          variant={camera ? 'default' : 'danger'}
        />
        {onDraftDecision && (
          <PillButton
            icon={PenLine}
            title="Draft a decision manually"
            helpBody="Skip the auto-compose pool and write a decision yourself. Useful when the room agrees on what to build but you want exact wording before the executor runs."
            onClick={onDraftDecision}
          />
        )}
        {onToggleThinking && (
          <PillButton
            icon={Brain}
            title={
              thinkingMode
                ? 'Thinking mode ON · deeper reasoning, slower'
                : 'Thinking mode OFF · fast, no reasoning'
            }
            helpBody="When ON, the executor uses extended reasoning — slower but better for complex tasks. When OFF, the executor runs fast without thinking tokens. Per-task value is captured at submit time."
            onClick={onToggleThinking}
            variant={thinkingMode ? 'active' : 'default'}
          />
        )}
        <PillButton
          icon={PhoneOff}
          title="Leave room"
          helpBody="Closes your connection to this room. The room and its sandbox keep running for everyone else — you can rejoin from the dashboard."
          onClick={onEndCall}
          variant="danger"
        />
      </div>

      {/* Desktop: full toolbar. Vibe pill lives in the top-left anchor. */}
      <div className="hidden md:flex items-center gap-5">
        <PillButton
          icon={mic ? Mic : MicOff}
          title={mic ? 'Mute mic' : 'Unmute mic'}
          helpBody="Mutes your microphone for other humans in the room. Separate from Vibe — even with your mic on, Vibe controls whether the AI listens."
          onClick={() => toggleMic()}
          variant={mic ? 'default' : 'danger'}
        />
        <PillButton
          icon={camera ? Video : VideoOff}
          title={camera ? 'Stop camera' : 'Start camera'}
          helpBody="Turns your camera feed on or off. Other participants only see your video when this is on."
          onClick={() => toggleCamera()}
          variant={camera ? 'default' : 'danger'}
        />
        {onDraftDecision && (
          <PillButton
            icon={PenLine}
            title="Draft a decision manually"
            helpBody="Skip the auto-compose pool and write a decision yourself. Useful when the room agrees on what to build but you want exact wording before the executor runs."
            onClick={onDraftDecision}
          />
        )}
        {onToggleThinking && (
          <PillButton
            icon={Brain}
            title={
              thinkingMode
                ? 'Thinking mode ON · deeper reasoning, slower'
                : 'Thinking mode OFF · fast, no reasoning'
            }
            helpBody="When ON, the executor uses extended reasoning — slower but better for complex tasks. When OFF, the executor runs fast without thinking tokens. Per-task value is captured at submit time."
            onClick={onToggleThinking}
            variant={thinkingMode ? 'active' : 'default'}
          />
        )}
        <PillButton
          icon={deviceFrame === 'mobile' ? Smartphone : Monitor}
          title={
            deviceFrame === 'mobile'
              ? 'Mobile preview — click to switch to desktop'
              : 'Desktop preview — click to switch to mobile'
          }
          helpBody="Switches the artifact preview between desktop (full canvas) and mobile (390px) frame. Helpful when you need to check how the design works on phones."
          onClick={() => onChangeDeviceFrame(deviceFrame === 'mobile' ? 'desktop' : 'mobile')}
        />
        <PillButton icon={PhoneOff} title="Leave room" onClick={onEndCall} variant="danger" />
      </div>
    </>
  );
}

function ParticipantTile({ participant, index }: { participant: Participant; index: number }) {
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
        animate={{ opacity: 1, y: isSpeaking ? -8 : 0 }}
        transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
        style={{ width: '160px', height: '100px' }}
        className={`relative overflow-hidden rounded-[20px] border transition-all duration-300 hover:!w-[240px] hover:!h-[150px] ${
          isSpeaking
            ? 'border-blue-400/80 shadow-[0_0_36px_rgba(79,140,255,.55)]'
            : 'border-white/15 shadow-2xl'
        } ${!micEnabled ? 'opacity-60 saturate-50' : ''}`}
      >
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

        {!micEnabled && (
          <div className="absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-black/60 backdrop-blur-sm">
            <MicOff size={12} className="text-red-300" />
          </div>
        )}

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
