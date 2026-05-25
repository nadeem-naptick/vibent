'use client';

import { useEffect, useState } from 'react';
import {
  Command,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Users,
  Clock3,
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
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/42 px-4 py-3 shadow-2xl backdrop-blur-2xl min-w-0">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-blue-500 text-white shadow-[0_0_34px_rgba(79,140,255,.42)] shrink-0">
          <Command size={18} />
        </div>
        <div className="pr-2 min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="truncate max-w-[280px]">{roomTitle}</span>
            <span className="flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-100 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" /> Live
            </span>
          </div>
          <div className="text-xs text-white/45 truncate">{roomSubtitle}</div>
        </div>
      </div>

      <div className="pointer-events-auto flex items-center gap-2 flex-wrap justify-end">
        <FloatingButton icon={Users} label={`${participants.length} ${participants.length === 1 ? 'person' : 'people'}`} active />
        <FloatingButton icon={Clock3} label={formatTime(elapsedSec)} />
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
        <FloatingButton icon={MonitorUp} label="Share" onClick={toggleScreenShare} />
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
