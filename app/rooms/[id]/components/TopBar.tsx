'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Command,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Users,
  Clock3,
  MoreHorizontal,
} from 'lucide-react';
import { useLocalParticipant, useParticipants } from '@livekit/components-react';
import { FloatingButton } from './FloatingButton';

type Props = {
  roomTitle: string;
  roomSubtitle: string;
};

export function TopBar({ roomTitle, roomSubtitle }: Props) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Track elapsed time since room load
  useEffect(() => {
    const start = Date.now();
    const i = setInterval(() => setElapsedSec(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(i);
  }, []);

  // Sync local UI state with actual LiveKit track state
  useEffect(() => {
    if (!localParticipant) return;
    setMic(localParticipant.isMicrophoneEnabled);
    setCamera(localParticipant.isCameraEnabled);
  }, [localParticipant]);

  async function toggleMic() {
    if (!localParticipant) return;
    const next = !mic;
    setMic(next);
    try {
      await localParticipant.setMicrophoneEnabled(next);
    } catch (err) {
      setMic(!next);
      console.error('[topbar] mic toggle failed:', err);
    }
  }

  async function toggleCamera() {
    if (!localParticipant) return;
    const next = !camera;
    setCamera(next);
    try {
      await localParticipant.setCameraEnabled(next);
    } catch (err) {
      setCamera(!next);
      console.error('[topbar] camera toggle failed:', err);
    }
  }

  async function toggleScreenShare() {
    if (!localParticipant) return;
    try {
      await localParticipant.setScreenShareEnabled(!localParticipant.isScreenShareEnabled);
    } catch (err) {
      console.error('[topbar] share toggle failed:', err);
    }
  }

  return (
    <div className="pointer-events-none absolute left-5 right-5 top-5 z-30 flex items-center justify-between gap-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border-2 border-white/20 bg-slate-950/70 px-5 py-3.5 shadow-2xl backdrop-blur-2xl min-w-0">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-blue-500 text-white shadow-[0_0_34px_rgba(79,140,255,.42)] shrink-0">
          <Command size={20} />
        </div>
        <div className="pr-2 min-w-0">
          <div className="flex items-center gap-2 text-base font-semibold text-white">
            <span className="truncate max-w-[280px]">{roomTitle}</span>
            <span className="flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-100 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" /> Live
            </span>
          </div>
          <div className="text-sm text-white/55 truncate">{roomSubtitle}</div>
        </div>
      </div>

      <div className="pointer-events-auto flex items-center gap-2 justify-end">
        {/* Always-visible essentials */}
        <FloatingButton icon={Users} label={`${participants.length} ${participants.length === 1 ? 'person' : 'people'}`} active />
        <FloatingButton
          icon={mic ? Mic : MicOff}
          label={mic ? 'Mic on' : 'Muted'}
          active={mic}
          onClick={toggleMic}
        />
        <FloatingButton
          icon={camera ? Video : VideoOff}
          label={camera ? 'Camera' : 'Camera off'}
          active={camera}
          onClick={toggleCamera}
        />

        {/* Hidden behind overflow menu at < md (768px) */}
        <div className="hidden md:flex items-center gap-2">
          <FloatingButton icon={Clock3} label={formatTime(elapsedSec)} />
          <FloatingButton icon={MonitorUp} label="Share" onClick={toggleScreenShare} />
        </div>

        {/* Overflow menu shown on narrow viewports */}
        <div className="md:hidden">
          <OverflowMenu
            elapsedSec={elapsedSec}
            onShare={toggleScreenShare}
          />
        </div>
      </div>
    </div>
  );
}

function formatTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function OverflowMenu({
  elapsedSec,
  onShare,
}: {
  elapsedSec: number;
  onShare: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <FloatingButton
        icon={MoreHorizontal}
        label="More"
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="absolute top-full right-0 mt-2 min-w-[180px] rounded-2xl border border-white/10 bg-[#0B0F14]/95 shadow-2xl backdrop-blur-2xl p-2 z-50">
          <div className="px-3 py-2 text-sm text-white/70 flex items-center gap-2">
            <Clock3 size={14} /> {formatTime(elapsedSec)}
          </div>
          <button
            onClick={() => {
              onShare();
              setOpen(false);
            }}
            className="w-full px-3 py-2 text-sm text-left text-white/80 rounded-lg hover:bg-white/5 flex items-center gap-2"
          >
            <MonitorUp size={14} /> Share screen
          </button>
        </div>
      )}
    </div>
  );
}
