'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'agentic.settings.v1';
const DEFAULT_THRESHOLD = 7;
const MIN_THRESHOLD = 3;
const MAX_THRESHOLD = 20;
const DEFAULT_COUNTDOWN_MS = 5000;

export type DeviceFrame = 'mobile' | 'desktop';

export type RoomSettings = {
  // How many detections to accumulate before auto-composing into a decision.
  autoComposeThreshold: number;
  // How long a single detection stays in the "soft confirm" countdown before
  // joining the pool. Not user-editable yet, but here so we can expose later.
  countdownMs: number;
  // How wide the preview iframe is rendered. desktop = full canvas, tablet =
  // 768px, mobile = 390px (matches modern iPhone widths).
  deviceFrame: DeviceFrame;
  // Hides all overlay chrome and shows only the canvas. The agent/STT/tasks
  // keep running in the background.
  focusMode: boolean;
  // When true, the executing agent uses extended reasoning (slower, deeper).
  // When false, it runs in fast mode without thinking tokens. Per-task value
  // is captured at submit time and persisted on the task row.
  thinkingMode: boolean;
};

const DEFAULT_SETTINGS: RoomSettings = {
  autoComposeThreshold: DEFAULT_THRESHOLD,
  countdownMs: DEFAULT_COUNTDOWN_MS,
  deviceFrame: 'desktop',
  focusMode: false,
  thinkingMode: true,
};

function read(): RoomSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<RoomSettings>;
    return {
      autoComposeThreshold: clamp(
        parsed.autoComposeThreshold ?? DEFAULT_THRESHOLD,
        MIN_THRESHOLD,
        MAX_THRESHOLD,
      ),
      countdownMs: parsed.countdownMs ?? DEFAULT_COUNTDOWN_MS,
      deviceFrame:
        parsed.deviceFrame === 'mobile' || parsed.deviceFrame === 'desktop'
          ? parsed.deviceFrame
          : 'desktop',
      focusMode: Boolean(parsed.focusMode),
      thinkingMode: parsed.thinkingMode === undefined ? true : Boolean(parsed.thinkingMode),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function useSettings() {
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    setSettings(read());
  }, []);

  const update = useCallback((patch: Partial<RoomSettings>) => {
    setSettings((prev) => {
      const next: RoomSettings = {
        autoComposeThreshold: clamp(
          patch.autoComposeThreshold ?? prev.autoComposeThreshold,
          MIN_THRESHOLD,
          MAX_THRESHOLD,
        ),
        countdownMs: patch.countdownMs ?? prev.countdownMs,
        deviceFrame: patch.deviceFrame ?? prev.deviceFrame,
        focusMode: patch.focusMode ?? prev.focusMode,
        thinkingMode: patch.thinkingMode ?? prev.thinkingMode,
      };
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // localStorage full or blocked — ignore.
        }
      }
      return next;
    });
  }, []);

  return { settings, update, limits: { MIN_THRESHOLD, MAX_THRESHOLD } };
}
