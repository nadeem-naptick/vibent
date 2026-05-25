'use client';

import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
  useConnectionState,
} from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import '@livekit/components-styles';
import { AIPanel } from './AIPanel';
import { useBrowserSTT } from './useBrowserSTT';
import { useRoomFeed } from './useRoomFeed';
import type { RoomFeed } from './types';

type Props = {
  roomId: string;
  token: string;
  serverUrl: string;
  sandboxUrl: string | null;
  status: string;
  isHost: boolean;
  speakerName: string;
  initialFeed: RoomFeed;
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
}: Props) {
  const [sandboxUrl, setSandboxUrl] = useState(initialSandboxUrl);
  const [status, setStatus] = useState(initialStatus);

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
        // network blip — retry on next tick
      }
    }, 2000);
    return () => clearInterval(i);
  }, [roomId, status]);

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      video
      audio
      data-lk-theme="default"
      className="flex-1 flex flex-col min-h-0"
    >
      <InnerLayout
        roomId={roomId}
        speakerName={speakerName}
        isHost={isHost}
        sandboxUrl={sandboxUrl}
        status={status}
        initialFeed={initialFeed}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function InnerLayout({
  roomId,
  speakerName,
  isHost,
  sandboxUrl,
  status,
  initialFeed,
}: {
  roomId: string;
  speakerName: string;
  isHost: boolean;
  sandboxUrl: string | null;
  status: string;
  initialFeed: RoomFeed;
}) {
  const connectionState = useConnectionState();
  const sttEnabled = connectionState === ConnectionState.Connected;

  useBrowserSTT({ roomId, speakerName, enabled: sttEnabled });
  const { feed, updateIntent } = useRoomFeed(initialFeed, roomId);

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr_360px] min-h-0">
      <section className="border-r border-neutral-900 min-h-[40vh] lg:min-h-0 bg-black">
        <VideoConference />
      </section>

      <section className="flex flex-col min-h-0">
        <div className="border-b border-neutral-900 px-4 py-2 text-xs uppercase tracking-widest text-neutral-500">
          Live preview
        </div>
        <div className="flex-1 bg-white">
          {sandboxUrl ? (
            <iframe
              key={sandboxUrl}
              src={sandboxUrl}
              className="w-full h-full border-0"
              title="Room artifact preview"
            />
          ) : status === 'error' ? (
            <PreviewMessage tone="error">
              Sandbox provisioning failed. Check server logs.
            </PreviewMessage>
          ) : (
            <PreviewMessage tone="info">
              Provisioning workspace… this takes 10–30 seconds.
            </PreviewMessage>
          )}
        </div>
      </section>

      <section className="border-l border-neutral-900 min-h-[40vh] lg:min-h-0">
        <AIPanel
          transcripts={feed.transcripts}
          intents={feed.intents}
          isHost={isHost}
          onUpdateIntent={updateIntent}
        />
      </section>
    </div>
  );
}

function PreviewMessage({
  tone,
  children,
}: {
  tone: 'info' | 'error';
  children: React.ReactNode;
}) {
  const colors =
    tone === 'error' ? 'bg-red-50 text-red-900' : 'bg-neutral-50 text-neutral-600';
  return (
    <div className={`h-full flex items-center justify-center ${colors}`}>
      <p className="text-sm">{children}</p>
    </div>
  );
}
