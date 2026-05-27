'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Settings2,
  Maximize2,
  Download,
  Focus,
  Share2,
  Copy,
  CheckCircle2,
  Loader2,
  X,
  ExternalLink,
  MoreHorizontal,
} from 'lucide-react';
import type { RoomSettings } from '../useSettings';
import { PillButton } from './PillButton';

type Props = {
  roomId: string;
  settings: RoomSettings;
  updateSettings: (patch: Partial<RoomSettings>) => void;
  thresholdLimits: { MIN_THRESHOLD: number; MAX_THRESHOLD: number };
  onEnterFocus: () => void;
};

export function BottomActionCluster({
  roomId,
  settings,
  updateSettings,
  thresholdLimits,
  onEnterFocus,
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

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  async function downloadExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/export`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      // Pull suggested filename from Content-Disposition; fall back to a default.
      const cd = res.headers.get('content-disposition') ?? '';
      const m = cd.match(/filename="([^"]+)"/);
      const filename = m?.[1] ?? 'vibent-export.zip';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'export failed';
      setExportError(msg);
      console.error('[export]', msg);
    } finally {
      setExporting(false);
    }
  }

  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  async function openShare() {
    setShareOpen(true);
    if (shareUrl) return; // already built this session — show existing URL
    setSharing(true);
    setShareError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/share`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      setShareUrl(data.url);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'share failed');
    } finally {
      setSharing(false);
    }
  }
  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API may fail in iframes — silently ignore
    }
  }
  function closeShare() {
    setShareOpen(false);
  }

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile: single ⋯ pill that opens a bottom-sheet menu. */}
      <div className="md:hidden absolute bottom-4 right-4 z-30">
        <PillButton
          icon={MoreHorizontal}
          title="Room actions"
          onClick={() => setMobileMenuOpen(true)}
        />
        {mobileMenuOpen && (
          <MobileActionsSheet
            onClose={() => setMobileMenuOpen(false)}
            settings={settings}
            updateSettings={updateSettings}
            limits={limits}
            onEnterFocus={() => {
              setMobileMenuOpen(false);
              onEnterFocus();
            }}
            onFullscreen={() => {
              setMobileMenuOpen(false);
              toggleFullscreen();
            }}
            onShare={() => {
              setMobileMenuOpen(false);
              openShare();
            }}
            onExport={() => {
              setMobileMenuOpen(false);
              downloadExport();
            }}
            exporting={exporting}
          />
        )}
      </div>

      {/* Desktop: the existing horizontal row of 5 pills. */}
      <div className="hidden md:flex absolute bottom-6 right-6 z-30 items-center gap-5">
      {/* Settings popover */}
      <div className="relative" ref={popoverRef}>
        <PillButton
          icon={Settings2}
          title="Room settings"
          onClick={() => setSettingsOpen((v) => !v)}
        />
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

      <PillButton
        icon={Focus}
        title="Focus mode — hide all chrome (F)"
        onClick={onEnterFocus}
      />

      <PillButton icon={Maximize2} title="Fullscreen" onClick={toggleFullscreen} />

      <PillButton
        icon={Share2}
        label="Share"
        title="Build + share a public URL of the current artifact"
        onClick={openShare}
      />

      <PillButton
        icon={exporting ? Loader2 : Download}
        label={exporting ? 'Building…' : 'Export'}
        title="Build the project and download a ZIP of the static site"
        onClick={downloadExport}
        variant="primary"
      />

      {exportError && (
        <div className="absolute bottom-full right-0 mb-2 max-w-sm rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 backdrop-blur-xl">
          {exportError}
        </div>
      )}

      </div>

      {shareOpen && (
        <ShareModal
          sharing={sharing}
          url={shareUrl}
          error={shareError}
          copied={copied}
          onCopy={copyShareUrl}
          onClose={closeShare}
        />
      )}
    </>
  );
}

function MobileActionsSheet({
  onClose,
  settings,
  updateSettings,
  limits,
  onEnterFocus,
  onFullscreen,
  onShare,
  onExport,
  exporting,
}: {
  onClose: () => void;
  settings: RoomSettings;
  updateSettings: (patch: Partial<RoomSettings>) => void;
  limits: { MIN_THRESHOLD: number; MAX_THRESHOLD: number };
  onEnterFocus: () => void;
  onFullscreen: () => void;
  onShare: () => void;
  onExport: () => void;
  exporting: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-stretch bg-black/60 backdrop-blur-sm md:hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#0B0F14] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Room actions</h3>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/8 text-white/65">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          <MobileAction icon={Share2} label="Share" onClick={onShare} />
          <MobileAction
            icon={exporting ? Loader2 : Download}
            label={exporting ? 'Building export…' : 'Export'}
            onClick={onExport}
            iconClassName={exporting ? 'animate-spin' : ''}
            primary
          />
          <MobileAction icon={Focus} label="Focus mode" onClick={onEnterFocus} />
          <MobileAction icon={Maximize2} label="Fullscreen" onClick={onFullscreen} />
        </div>

        <div className="mt-6 pt-5 border-t border-white/8">
          <h4 className="text-[11px] uppercase tracking-widest text-white/45 mb-2.5">Auto-compose</h4>
          <label className="block">
            <span className="text-sm text-white/80">Detections per decision</span>
            <input
              type="number"
              min={limits.MIN_THRESHOLD}
              max={limits.MAX_THRESHOLD}
              value={settings.autoComposeThreshold}
              onChange={(e) =>
                updateSettings({ autoComposeThreshold: parseInt(e.target.value, 10) || 7 })
              }
              className="mt-1.5 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-400/40"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function MobileAction({
  icon: Icon,
  label,
  onClick,
  primary,
  iconClassName,
}: {
  icon: typeof Settings2;
  label: string;
  onClick: () => void;
  primary?: boolean;
  iconClassName?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
        primary
          ? 'bg-white text-neutral-950 hover:bg-blue-50'
          : 'bg-white/[0.04] text-white/85 hover:bg-white/[0.08]'
      }`}
    >
      <Icon size={20} className={iconClassName} />
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

function ShareModal({
  sharing,
  url,
  error,
  copied,
  onCopy,
  onClose,
}: {
  sharing: boolean;
  url: string | null;
  error: string | null;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#0B0F14]/95 p-6 shadow-2xl backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-white/45 hover:text-white"
        >
          <X size={18} />
        </button>

        <h2 className="text-lg font-semibold text-white">Share this artifact</h2>
        <p className="mt-1 text-sm text-white/55">
          A permanent public link to a built snapshot of your current page.
          Anyone with the link can view it — no sign-in needed.
        </p>

        <div className="mt-5">
          {sharing && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <Loader2 size={18} className="text-blue-300 animate-spin" />
              <div className="text-sm text-white/75">
                Building & uploading…{' '}
                <span className="text-white/45">~20-40 seconds</span>
              </div>
            </div>
          )}

          {error && !sharing && (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {url && !sharing && (
            <>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 bg-transparent text-sm text-white outline-none truncate"
                />
                <button
                  onClick={onCopy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 size={13} className="text-emerald-300" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-300 hover:text-blue-200"
                >
                  <ExternalLink size={13} />
                  Open in new tab
                </a>
                <span className="text-white/40">
                  Built from your current artifact · doesn&apos;t auto-update
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
