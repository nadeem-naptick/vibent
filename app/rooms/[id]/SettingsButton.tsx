'use client';

import { useEffect, useRef, useState } from 'react';
import { useSettings } from './useSettings';

export function SettingsButton() {
  const { settings, update, limits } = useSettings();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!popoverRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Room settings"
        className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors px-2"
      >
        ⚙
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 w-72 rounded-md border border-neutral-800 bg-neutral-950 shadow-xl p-4 z-30">
          <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-3">
            Auto-compose
          </h3>
          <label className="block">
            <span className="text-sm text-neutral-300">
              Detections per decision
            </span>
            <input
              type="number"
              min={limits.MIN_THRESHOLD}
              max={limits.MAX_THRESHOLD}
              value={settings.autoComposeThreshold}
              onChange={(e) =>
                update({ autoComposeThreshold: parseInt(e.target.value, 10) || 7 })
              }
              className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-600"
            />
            <span className="block text-xs text-neutral-600 mt-1.5 leading-snug">
              Once this many detections survive the 5-second window, they
              auto-compose into a decision and queue for execution.
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
