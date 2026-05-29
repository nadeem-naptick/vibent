'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { ParticipantDock } from './components/ParticipantDock';
import { DecisionStack } from './components/DecisionStack';
import { BuildingStack } from './components/BuildingStack';
import { LiveTaskActivity } from './components/LiveTaskActivity';
import { TopCenterRail, type DrawerType } from './components/TopCenterRail';
import { Drawer } from './components/Drawer';
import { Canvas } from './components/Canvas';
import { BottomActionCluster } from './components/BottomActionCluster';
import { ExitFocusPill } from './components/ExitFocusPill';
import { RoomLoadingScreen } from './components/RoomLoadingScreen';
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
  room: Pick<Room, 'title' | 'objective' | 'outputType' | 'context' | 'templateId' | 'instructions'>;
};

type RestoreMode = 'reattach' | 'restore' | 'unknown' | 'ready' | 'error';

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
  // Tracks what /restore decided to do, so the loading screen can show
  // accurate ETA + explanation copy.
  const [restoreMode, setRestoreMode] = useState<RestoreMode>(
    initialStatus === 'active' && initialSandboxUrl ? 'unknown' : 'restore',
  );
  // Minimum visible time for the loading screen so it doesn't just flash by
  // when the sandbox is already warm in memory. The user explicitly wants to
  // see what's happening, not get yanked into the room with no context.
  const [minTimeMet, setMinTimeMet] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinTimeMet(true), 1400);
    return () => clearTimeout(t);
  }, []);

  // Always probe the sandbox on mount. The /restore endpoint is idempotent:
  //   - in-memory handle alive: returns immediately, no DB change
  //   - no handle but sandbox alive at provider: reattach (fast), no DB change
  //   - sandbox genuinely dead: flips DB to 'provisioning' + restores
  //
  // If the response says we kicked off a full restore, drop the cached URL
  // and start polling so the user sees the new sandbox URL when it's ready.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/restore`, { method: 'POST' });
        if (cancelled) return;
        const data = await res.json().catch(() => ({}));
        if (data?.status === 'active' && data?.reattached) {
          // Sandbox was alive at provider, we just re-registered the handle —
          // no waiting needed, render the room immediately.
          setRestoreMode('ready');
        } else if (data?.status === 'active') {
          // Sandbox was already in-memory and alive.
          setRestoreMode('ready');
        } else if (data?.status === 'restoring') {
          // Full snapshot restore is now running in the background.
          setSandboxUrl(null);
          setStatus('provisioning');
          setRestoreMode('restore');
        } else if (data?.error) {
          setRestoreMode('error');
        }
      } catch (err) {
        console.warn('[room] restore trigger failed:', err);
        setRestoreMode('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // Poll while the sandbox is still being provisioned / restored. Stops once
  // the room flips to active (with a URL) or to error.
  useEffect(() => {
    if (status === 'archived') return;
    if (status === 'active' && sandboxUrl && restoreMode === 'ready') return;

    const i = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}`);
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.status);
        setSandboxUrl(data.sandboxUrl);
        if (data.status === 'active' && data.sandboxUrl) {
          setRestoreMode('ready');
          clearInterval(i);
        } else if (data.status === 'error') {
          setRestoreMode('error');
          clearInterval(i);
        }
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(i);
  }, [roomId, status, sandboxUrl, restoreMode]);

  async function handleRetry() {
    setRestoreMode('unknown');
    setStatus('provisioning');
    try {
      const res = await fetch(`/api/rooms/${roomId}/restore`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (data?.status === 'restoring') setRestoreMode('restore');
      else if (data?.error) setRestoreMode('error');
    } catch {
      setRestoreMode('error');
    }
  }

  async function handleRecreate() {
    setRestoreMode('restore');
    setStatus('provisioning');
    setSandboxUrl(null);
    try {
      await fetch(`/api/rooms/${roomId}/recreate`, { method: 'POST' });
    } catch {
      setRestoreMode('error');
    }
  }

  const sandboxNotReady =
    restoreMode === 'error' ||
    !sandboxUrl ||
    status !== 'active' ||
    restoreMode === 'unknown' ||
    restoreMode === 'restore' ||
    restoreMode === 'reattach';

  // Show loading while sandbox isn't ready, OR while we're still inside the
  // minimum-display window (so the screen is actually visible to the user
  // instead of flashing for 80ms when the sandbox is already warm).
  const showLoading = sandboxNotReady || !minTimeMet;

  if (showLoading) {
    // Pick the mode to show. If the sandbox is already ready and we're just
    // holding for min-time, surface a 'reattach'-style screen (fast ETA) so
    // it doesn't look like a stuck full restore.
    const displayMode: 'reattach' | 'restore' | 'unknown' | 'error' =
      restoreMode === 'error'
        ? 'error'
        : sandboxNotReady
          ? restoreMode === 'ready'
            ? 'unknown'
            : restoreMode
          : 'reattach';
    return (
      <RoomLoadingScreen
        mode={displayMode}
        roomTitle={room.title}
        onRetry={restoreMode === 'error' ? handleRetry : undefined}
        onRecreate={restoreMode === 'error' ? handleRecreate : undefined}
      />
    );
  }

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

  const { feed, updateIntent, addLocalTranscript, addLocalIntent, completedTaskCount } =
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
    thinkingMode: settings.thinkingMode,
    onIgnoreIntent: (id) => updateIntent(id, { status: 'ignored' }),
    onPoolComposed: () => {
      // Could pop the Tasks drawer here, but the BuildingStack already
      // surfaces the new task in the bottom-right.
    },
  });

  // Iframe refresh on task completion (Vite HMR handles most cases but this
  // forces a hard reload as a safety net). Triggered by completedTaskCount
  // so every new completion bumps it, not just the first one.
  const [iframeNonce, setIframeNonce] = useState(0);
  useEffect(() => {
    if (completedTaskCount > 0) setIframeNonce((n) => n + 1);
  }, [completedTaskCount]);

  // Skeleton-complete milestone: when the agent calls mark_skeleton_complete
  // (Phase 1 of a two-phase build), force an early iframe reload so the user
  // sees the skeleton render right away. Phase 2 (research + polish) keeps
  // going in the background. Track which task IDs we've already reacted to
  // so we don't bump repeatedly as the same event sits in the running task's
  // event stream.
  const [skeletonNoticed] = useState(() => new Set<string>());
  useEffect(() => {
    for (const task of feed.tasks) {
      if (task.status !== 'running' && task.status !== 'complete') continue;
      if (skeletonNoticed.has(task.id)) continue;
      const hasSkeleton = task.events.some(
        (e) => e.kind === 'tool_call' && e.toolName === 'mark_skeleton_complete',
      );
      if (hasSkeleton) {
        skeletonNoticed.add(task.id);
        setIframeNonce((n) => n + 1);
      }
    }
  }, [feed.tasks, skeletonNoticed]);
  const [rollbackNonce, setRollbackNonce] = useState(0);
  const iframeKey = `${sandboxUrl ?? 'none'}#${iframeNonce}#${rollbackNonce}`;

  const [drawer, setDrawer] = useState<DrawerType | null>(null);

  const activeTaskCount = feed.tasks.filter(
    (t) => t.status === 'queued' || t.status === 'running',
  ).length;

  // Most-recently-started running task — used by Canvas's empty state
  // ticker and the mobile floating activity pill. Picks the latest queued
  // or running task; if none, undefined.
  const activeTask = feed.tasks
    .filter((t) => t.status === 'queued' || t.status === 'running')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  // Focus mode: hide all chrome, keep STT/tasks/agent running in background
  const focusMode = settings.focusMode;
  const enterFocus = useCallback(() => updateSettings({ focusMode: true }), [updateSettings]);
  const exitFocus = useCallback(() => updateSettings({ focusMode: false }), [updateSettings]);

  // Keyboard shortcut: F toggles focus mode (unless user is typing in an input)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'f' && e.key !== 'F') return;
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (isTyping) return;
      if (focusMode) exitFocus();
      else enterFocus();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode, enterFocus, exitFocus]);

  return (
    <>
      <Canvas
        sandboxUrl={sandboxUrl}
        status={status}
        iframeKey={iframeKey}
        deviceFrame={settings.deviceFrame}
        roomId={roomId}
        templateId={room.templateId}
        hasFirstVersion={feed.versions.length > 0 || completedTaskCount > 0}
        activeTask={activeTask}
      />

      {focusMode ? (
        <ExitFocusPill onClick={exitFocus} />
      ) : (
        <>
          <TopCenterRail
            badges={{
              transcript: feed.transcripts.length,
              tasks: activeTaskCount,
              versions: feed.versions.length,
            }}
            onOpen={setDrawer}
          />

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
            thinkingMode={settings.thinkingMode}
            onToggleThinking={() => updateSettings({ thinkingMode: !settings.thinkingMode })}
          />

          <BuildingStack tasks={feed.tasks} isHost={isHost} />

          {/* Mobile activity pill — desktop has BuildingStack instead.
              Shows only when there's a running task AND we're past the
              empty-state phase (since the overlay already shows the same
              ticker in its center). */}
          {activeTask && (feed.versions.length > 0 || completedTaskCount > 0) && (
            <div className="md:hidden absolute left-3 right-3 top-20 z-30">
              <LiveTaskActivity task={activeTask} />
            </div>
          )}

          <ParticipantDock
            onEndCall={onExitRoom}
            deviceFrame={settings.deviceFrame}
            onChangeDeviceFrame={(f) => updateSettings({ deviceFrame: f })}
          />

          <BottomActionCluster
            roomId={roomId}
            settings={settings}
            updateSettings={updateSettings}
            thresholdLimits={thresholdLimits}
            onEnterFocus={enterFocus}
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
      )}
    </>
  );
}
