'use client';

import { useEffect, useRef, useState } from 'react';
import { Settings2, Maximize2, Download, LogOut } from 'lucide-react';
import type { RoomSettings } from '../useSettings';

type Props = {
  roomId: string;
  onExitRoom: () => void;
  settings: RoomSettings;
  updateSettings: (patch: Partial<RoomSettings>) => void;
  thresholdLimits: { MIN_THRESHOLD: number; MAX_THRESHOLD: number };
};

export function BottomActionCluster({
  roomId,
  onExitRoom,
  settings,
  updateSettings,
  thresholdLimits,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const update = updateSettings;
  const limits = thresholdLimits;

  useEffect(() => {
    if (!settingsOpen) return;
    function onClick(e: MouseEvent) {
      if (!popoverRef.current?.contains(e.target as Node)) setSettingsOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [settingsOpen]);

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.warn('[fullscreen] failed:', err);
      }
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  }

  function downloadExport() {
    // Placeholder hook — M5 wires real ZIP export. For now open the latest
    // version snapshot directly in a new tab as JSON, so the user has something.
    window.open(`/api/rooms/${roomId}/versions`, '_blank');
  }

  return (
    <div className="absolute bottom-6 right-6 z-30 flex items-center gap-3">
      {/* Settings popover */}
      <div className="relative" ref={popoverRef}>
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          title="Room settings"
          style={{ width: '56px', height: '56px' }}
          className="grid place-items-center rounded-2xl border-2 border-white/20 bg-slate-950/70 text-white/75 shadow-2xl backdrop-blur-2xl hover:text-white"
        >
          <Settings2 size={22} />
        </button>
        {settingsOpen && (
          <div className="absolute bottom-full right-0 mb-2 w-72 rounded-2xl border border-white/10 bg-[#0B0F14]/95 shadow-2xl backdrop-blur-2xl p-4">
            <h3 className="text-xs uppercase tracking-widest text-white/45 mb-3">
              Auto-compose
            </h3>
            <label className="block">
              <span className="text-sm text-white/80">Detections per decision</span>
              <input
                type="number"
                min={limits.MIN_THRESHOLD}
                max={limits.MAX_THRESHOLD}
                value={settings.autoComposeThreshold}
                onChange={(e) =>
                  update({ autoComposeThreshold: parseInt(e.target.value, 10) || 7 })
                }
                className="mt-1.5 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-400/40"
              />
              <span className="block text-[11px] text-white/45 mt-2 leading-snug">
                Once this many detections survive the 5-second window, they
                auto-compose into a decision and queue for execution.
              </span>
            </label>
          </div>
        )}
      </div>

      <button
        onClick={toggleFullscreen}
        title="Fullscreen"
        style={{ width: '56px', height: '56px' }}
        className="grid place-items-center rounded-2xl border-2 border-white/20 bg-slate-950/70 text-white/75 shadow-2xl backdrop-blur-2xl hover:text-white"
      >
        <Maximize2 size={22} />
      </button>

      <button
        onClick={downloadExport}
        title="Export"
        style={{ height: '56px' }}
        className="flex items-center gap-2 rounded-2xl bg-white px-6 text-base font-semibold text-black shadow-2xl hover:bg-blue-100"
      >
        <Download size={20} /> Export
      </button>

      <button
        onClick={onExitRoom}
        title="Leave room"
        style={{ width: '56px', height: '56px' }}
        className="grid place-items-center rounded-2xl border-2 border-white/20 bg-slate-950/70 text-white/75 shadow-2xl backdrop-blur-2xl hover:text-red-300 hover:border-red-400/40"
      >
        <LogOut size={22} />
      </button>
    </div>
  );
}
