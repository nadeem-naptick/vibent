'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
} from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import '@livekit/components-styles';
import { useBrowserSTT } from './useBrowserSTT';
import { useRoomFeed } from './useRoomFeed';
import { useAutoCompose } from './useAutoCompose';
import { useRoomToasts } from './useRoomToasts';
import { useSettings } from './useSettings';
import type { RoomFeed } from './types';
import { TopBar } from './components/TopBar';
import { ParticipantDock } from './components/ParticipantDock';
import { DecisionStack } from './components/DecisionStack';
import { BuildingStack } from './components/BuildingStack';
import { SideRail, type DrawerType } from './components/SideRail';
import { Drawer } from './components/Drawer';
import { Canvas } from './components/Canvas';
import { BottomActionCluster } from './components/BottomActionCluster';
import { DeviceToggle } from './components/DeviceToggle';
import { OBJECTIVE_LABELS } from '@/lib/templates';
import type { Room } from '@/lib/db/schema';

type Props = {
  roomId: string;
  token: string;
  serverUrl: string;
  sandboxUrl: string | null;
  status: string;
  isHost: boolean;
  speakerName: string;
  initialFeed: RoomFeed;
  room: Pick<Room, 'title' | 'objective' | 'outputType' | 'context'>;
};

export function LiveRoomClient({
  roomId,
  token,
  serverUrl,
  sandboxUrl: initialSandboxUrl,
  status: initialStatus,
  isHost,
  speakerName,
  initialFeed,
  room,
}: Props) {
  const router = useRouter();
  const [sandboxUrl, setSandboxUrl] = useState(initialSandboxUrl);
  const [status, setStatus] = useState(initialStatus);

  // Always probe the sandbox on mount. The /restore endpoint is idempotent:
  //   - if the sandbox is alive (alive check on sandboxManager): no-op
  //   - if it's dead: flip room to 'provisioning' + start background restore
  // The room's actual status only changes if the sandbox is genuinely dead.
  useEffect(() => {
    fetch(`/api/rooms/${roomId}/restore`, { method: 'POST' }).catch((err) => {
      console.warn('[room] restore trigger failed:', err);
    });
  }, [roomId]);

  // Poll while the sandbox is still provisioning.
  useEffect(() => {
    if (status === 'active' || status === 'archived') return;
    const i = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}`);
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.status);
        setSandboxUrl(data.sandboxUrl);
        if (data.status === 'active' || data.status === 'error') clearInterval(i);
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(i);
  }, [roomId, status]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#05070A] text-white">
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect
        video
        audio
        data-lk-theme="default"
        className="absolute inset-0"
      >
        <RoomShell
          roomId={roomId}
          speakerName={speakerName}
          isHost={isHost}
          sandboxUrl={sandboxUrl}
          status={status}
          initialFeed={initialFeed}
          room={room}
          onExitRoom={() => router.push('/dashboard')}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}

function RoomShell({
  roomId,
  speakerName,
  isHost,
  sandboxUrl,
  status,
  initialFeed,
  room,
  onExitRoom,
}: {
  roomId: string;
  speakerName: string;
  isHost: boolean;
  sandboxUrl: string | null;
  status: string;
  initialFeed: RoomFeed;
  room: Props['room'];
  onExitRoom: () => void;
}) {
  const connectionState = useConnectionState();
  const sttEnabled = connectionState === ConnectionState.Connected;

  const { feed, updateIntent, addLocalTranscript, addLocalIntent, lastCompletedTaskId } =
    useRoomFeed(initialFeed, roomId);

  const { settings, update: updateSettings, limits: thresholdLimits } = useSettings();

  // Fire toast notifications on task / version state changes
  useRoomToasts({ tasks: feed.tasks, versions: feed.versions });

  useBrowserSTT({
    roomId,
    speakerName,
    enabled: sttEnabled,
    onLocalTranscript: addLocalTranscript,
    onLocalIntent: addLocalIntent,
  });

  // Auto-compose lifecycle (preserved from before — drives the DecisionStack)
  const autoCompose = useAutoCompose({
    roomId,
    intents: feed.intents,
    isHost,
    onIgnoreIntent: (id) => updateIntent(id, { status: 'ignored' }),
    onPoolComposed: () => {
      // Could pop the Tasks drawer here, but the BuildingStack already
      // surfaces the new task in the bottom-right.
    },
  });

  // Iframe refresh on task completion (Vite HMR handles most cases but this
  // forces a hard reload as a safety net).
  const [iframeNonce, setIframeNonce] = useState(0);
  useEffect(() => {
    if (lastCompletedTaskId) setIframeNonce((n) => n + 1);
  }, [lastCompletedTaskId]);
  const [rollbackNonce, setRollbackNonce] = useState(0);
  const iframeKey = `${sandboxUrl ?? 'none'}#${iframeNonce}#${rollbackNonce}`;

  const [drawer, setDrawer] = useState<DrawerType | null>(null);

  const activeTaskCount = feed.tasks.filter(
    (t) => t.status === 'queued' || t.status === 'running',
  ).length;

  const subtitle =
    OBJECTIVE_LABELS[room.objective as keyof typeof OBJECTIVE_LABELS] ?? room.objective;

  return (
    <>
      <Canvas
        sandboxUrl={sandboxUrl}
        status={status}
        iframeKey={iframeKey}
        deviceFrame={settings.deviceFrame}
        roomId={roomId}
      />

      <TopBar roomTitle={room.title} roomSubtitle={subtitle} />

      <DecisionStack
        roomId={roomId}
        pending={autoCompose.pending}
        pool={autoCompose.pool}
        threshold={autoCompose.threshold}
        composing={autoCompose.composing}
        onRemovePending={autoCompose.removePending}
        onRemoveFromPool={autoCompose.removeFromPool}
        onApplyNow={autoCompose.composeNow}
        isHost={isHost}
      />

      <BuildingStack tasks={feed.tasks} isHost={isHost} />

      <SideRail
        badges={{
          transcript: feed.transcripts.length,
          tasks: activeTaskCount,
          versions: feed.versions.length,
        }}
        onOpen={setDrawer}
      />

      <ParticipantDock />

      <DeviceToggle
        value={settings.deviceFrame}
        onChange={(f) => updateSettings({ deviceFrame: f })}
      />

      <BottomActionCluster
        roomId={roomId}
        onExitRoom={onExitRoom}
        settings={settings}
        updateSettings={updateSettings}
        thresholdLimits={thresholdLimits}
      />

      <Drawer
        type={drawer}
        onClose={() => setDrawer(null)}
        roomId={roomId}
        room={room}
        transcripts={feed.transcripts}
        intents={feed.intents}
        tasks={feed.tasks}
        versions={feed.versions}
        isHost={isHost}
        onRolledBack={() => setRollbackNonce((n) => n + 1)}
      />
    </>
  );
}
