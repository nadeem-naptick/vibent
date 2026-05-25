'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { DeviceFrame } from '../useSettings';

type Props = {
  sandboxUrl: string | null;
  status: string;
  iframeKey: string;
  deviceFrame: DeviceFrame;
  roomId: string;
};

const FRAME_WIDTH = '390px';
const FRAME_HEIGHT = '844px';

export function Canvas({ sandboxUrl, status, iframeKey, deviceFrame, roomId }: Props) {
  const isMobile = deviceFrame === 'mobile';
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#05070A] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,140,255,.10),transparent_36%),radial-gradient(circle_at_72%_35%,rgba(255,184,107,.06),transparent_30%),#05070A]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:44px_44px] opacity-50" />

      <div
        className={
          isMobile
            ? 'relative flex flex-col items-center justify-center gap-3 w-full h-full p-8'
            : 'absolute inset-0 px-4 py-4'
        }
      >
        {isMobile && (
          <div className="rounded-full border border-white/15 bg-slate-950/70 px-3 py-1 text-xs text-white/65 backdrop-blur-xl shadow-lg">
            Mobile preview · 390×844
          </div>
        )}
        <div
          className="relative overflow-hidden rounded-[28px] border border-white/8 bg-[#0B0F14] shadow-[0_40px_120px_rgba(0,0,0,.58)] transition-all duration-300"
          style={{
            width: isMobile ? FRAME_WIDTH : '100%',
            height: isMobile ? `min(${FRAME_HEIGHT}, calc(100vh - 220px))` : '100%',
            maxWidth: isMobile ? '95%' : undefined,
          }}
        >
          {sandboxUrl ? (
            <iframe
              key={iframeKey}
              src={sandboxUrl}
              className="h-full w-full border-0 bg-white"
              title="Room artifact preview"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            />
          ) : status === 'error' ? (
            <PreviewError roomId={roomId} />
          ) : (
            <PreviewLoading status={status} />
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewLoading({ status }: { status: string }) {
  const message =
    status === 'provisioning' ? 'Provisioning workspace' : 'Preparing workspace';
  const subtitle =
    status === 'provisioning'
      ? 'Booting sandbox · installing dependencies · starting Vite. Takes 20–40 seconds.'
      : 'One moment.';
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0B0F14] via-[#0F141B] to-[#0B0F14]" />
      <div
        className="absolute inset-0 opacity-30 animate-pulse"
        style={{
          background:
            'radial-gradient(circle at 30% 40%, rgba(79,140,255,0.18), transparent 50%), radial-gradient(circle at 70% 60%, rgba(168,85,247,0.10), transparent 50%)',
        }}
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)]"
        style={{ backgroundSize: '32px 32px' }}
      />
      <div className="relative z-10 h-full w-full flex flex-col items-center justify-center gap-4">
        <Loader2 size={28} className="text-blue-400 animate-spin" />
        <div className="text-center">
          <div className="text-base font-semibold text-white">{message}</div>
          <div className="mt-1 text-sm text-white/45 max-w-sm">{subtitle}</div>
        </div>
        <div className="mt-2 h-1 w-48 rounded-full overflow-hidden bg-white/5">
          <div className="h-full w-1/3 bg-gradient-to-r from-blue-500 to-blue-300 animate-[shimmer_2s_ease-in-out_infinite]" />
        </div>
      </div>
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}

function PreviewError({ roomId }: { roomId: string }) {
  const [recreating, setRecreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function recreate() {
    if (!confirm('Recreate sandbox from the Vite template? Your last successful version snapshot stays intact in the Versions drawer.')) return;
    setRecreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/recreate`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `recreate failed (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'recreate failed');
      setRecreating(false);
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#1A0B0B]">
      <div className="h-full w-full flex flex-col items-center justify-center gap-4 text-center px-8">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-red-500/15">
          <AlertTriangle size={24} className="text-red-300" />
        </div>
        <div className="text-base font-semibold text-red-100">Sandbox could not be restored</div>
        <div className="text-sm text-red-200/60 max-w-md leading-relaxed">
          The sandbox provider didn&apos;t respond (often: stale token, expired
          OIDC). Click below to provision a fresh sandbox from the Vite
          template. Your saved versions are preserved.
        </div>
        {error && <div className="text-xs text-red-300 max-w-md">{error}</div>}
        <button
          onClick={recreate}
          disabled={recreating}
          className="rounded-2xl bg-white text-red-950 px-5 py-2.5 text-sm font-semibold shadow-xl hover:bg-blue-100 disabled:opacity-50 transition-colors"
        >
          {recreating ? 'Recreating…' : 'Recreate sandbox'}
        </button>
      </div>
    </div>
  );
}
