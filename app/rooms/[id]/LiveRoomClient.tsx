'use client';

import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';

type Props = {
  roomId: string;
  token: string;
  serverUrl: string;
  sandboxUrl: string | null;
  status: string;
};

export function LiveRoomClient({
  roomId,
  token,
  serverUrl,
  sandboxUrl: initialSandboxUrl,
  status: initialStatus,
}: Props) {
  // Poll while the sandbox is still provisioning. Once it's active the URL
  // is set and we render the preview.
  const [sandboxUrl, setSandboxUrl] = useState(initialSandboxUrl);
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    if (status === 'active' || status === 'archived') return;
    const i = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}`);
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.status);
        setSandboxUrl(data.sandboxUrl);
        if (data.status === 'active' || data.status === 'error') {
          clearInterval(i);
        }
      } catch {
        // network blip — retry on next tick
      }
    }, 2000);
    return () => clearInterval(i);
  }, [roomId, status]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0">
      <section className="lg:w-1/3 border-r border-neutral-900 min-h-[40vh] lg:min-h-0 bg-black">
        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          connect
          video
          audio
          data-lk-theme="default"
          className="h-full"
        >
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </section>

      <section className="flex-1 flex flex-col min-h-0">
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
