'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { DrawerType } from './TopCenterRail';
import type { LiveTask, LiveVersion } from '../types';
import type { DetectedIntent, TranscriptSegment } from '@/lib/db/mongo';
import type { Room } from '@/lib/db/schema';
import { OBJECTIVE_LABELS, OUTPUT_TYPE_LABELS } from '@/lib/templates';

type Props = {
  type: DrawerType | null;
  onClose: () => void;
  roomId: string;
  room: Room | { title: string; objective: string; outputType: string; context: unknown };
  transcripts: TranscriptSegment[];
  intents: DetectedIntent[];
  tasks: LiveTask[];
  versions: LiveVersion[];
  isHost: boolean;
  onRolledBack: () => void;
};

const TITLES: Record<DrawerType, string> = {
  transcript: 'Transcript',
  tasks: 'Active tasks',
  versions: 'Versions',
  context: 'Room context',
};

const SUBTITLES: Record<DrawerType, string> = {
  transcript: 'Speaker-aware live capture',
  tasks: 'Queued, running, and recent',
  versions: 'Every snapshot. Rollback any time.',
  context: 'What the room is for',
};

export function Drawer({
  type,
  onClose,
  roomId,
  room,
  transcripts,
  intents: _intents,
  tasks,
  versions,
  isHost,
  onRolledBack,
}: Props) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {type && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[min(760px,calc(100vw-40px))] max-h-[80vh] flex flex-col rounded-[28px] border border-white/12 bg-[#0B0F14] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/8">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-white">{TITLES[type]}</div>
                <div className="text-sm text-white/45 truncate">{SUBTITLES[type]}</div>
              </div>
              <button
                onClick={onClose}
                title="Close"
                className="grid h-9 w-9 place-items-center rounded-full bg-white/8 text-white/65 hover:bg-white/15 hover:text-white shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-1">
              {type === 'transcript' && <TranscriptContent transcripts={transcripts} />}
              {type === 'tasks' && <TasksContent tasks={tasks} />}
              {type === 'versions' && (
                <VersionsContent
                  versions={versions}
                  roomId={roomId}
                  isHost={isHost}
                  onRolledBack={onRolledBack}
                />
              )}
              {type === 'context' && <ContextContent room={room} />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Content sections
// ---------------------------------------------------------------------------

function TranscriptContent({ transcripts }: { transcripts: TranscriptSegment[] }) {
  if (transcripts.length === 0) {
    return <Empty>Transcript will appear here as participants speak.</Empty>;
  }
  return (
    <ul>
      {transcripts.map((s, i) => (
        <li
          key={s.id}
          className={`flex items-start gap-4 px-4 py-3 rounded-lg ${
            i % 2 === 0 ? 'bg-white/[0.025]' : ''
          } hover:bg-white/[0.05] transition-colors`}
        >
          <div className="w-32 shrink-0">
            <div className="text-sm font-semibold text-blue-200">{s.speakerName}</div>
            <div className="text-[11px] text-white/40 tabular-nums mt-0.5">
              {formatTimeOfDay(s.createdAt)}
            </div>
          </div>
          <div className="flex-1 text-sm text-white/80 leading-relaxed">{s.text}</div>
        </li>
      ))}
    </ul>
  );
}

function formatTimeOfDay(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function TasksContent({ tasks }: { tasks: LiveTask[] }) {
  if (tasks.length === 0) {
    return <Empty>Compose a decision and tasks appear here.</Empty>;
  }
  return (
    <ul>
      {tasks.map((t, i) => (
        <li
          key={t.id}
          className={`flex items-start gap-4 px-4 py-3 rounded-lg ${
            i % 2 === 0 ? 'bg-white/[0.025]' : ''
          } hover:bg-white/[0.05] transition-colors`}
        >
          <div className="w-28 shrink-0">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[11px] capitalize ${
                t.status === 'complete'
                  ? 'bg-emerald-500/15 text-emerald-200'
                  : t.status === 'running'
                  ? 'bg-blue-500/15 text-blue-200 animate-pulse'
                  : t.status === 'failed'
                  ? 'bg-red-500/15 text-red-200'
                  : t.status === 'cancelled'
                  ? 'bg-white/10 text-white/55'
                  : 'bg-white/10 text-white/65'
              }`}
            >
              {t.status === 'running' ? 'running…' : t.status}
            </span>
            <div className="text-[11px] text-white/40 tabular-nums mt-1">
              {formatTimeOfDay(t.createdAt)}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white leading-snug">{t.instruction}</p>
            {t.summary && (
              <p className="mt-1.5 text-xs text-white/55 italic leading-relaxed">{t.summary}</p>
            )}
            {t.error && (
              <p className="mt-1.5 text-xs text-red-300/80 font-mono leading-snug">{t.error}</p>
            )}
          </div>
          <span className="text-[10px] text-white/30 shrink-0 mt-1">
            {t.model?.split('/').pop()}
          </span>
        </li>
      ))}
    </ul>
  );
}

type VersionDiff = {
  path: string;
  kind: 'added' | 'removed' | 'modified';
  prevBytes?: number;
  nextBytes?: number;
};

function VersionsContent({
  versions,
  roomId,
  isHost,
  onRolledBack,
}: {
  versions: LiveVersion[];
  roomId: string;
  isHost: boolean;
  onRolledBack: () => void;
}) {
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diffOpenId, setDiffOpenId] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<Record<string, VersionDiff[] | 'loading' | 'error'>>({});

  async function rollback(versionId: string, label: string) {
    if (!confirm(`Roll back to ${label}? Current sandbox files will be overwritten.`)) return;
    setRollingBack(versionId);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/versions/${versionId}/rollback`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `rollback failed (${res.status})`);
      }
      onRolledBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'rollback failed');
    } finally {
      setRollingBack(null);
    }
  }

  async function toggleDiff(versionId: string) {
    if (diffOpenId === versionId) {
      setDiffOpenId(null);
      return;
    }
    setDiffOpenId(versionId);
    if (diffs[versionId] && diffs[versionId] !== 'error') return;
    setDiffs((prev) => ({ ...prev, [versionId]: 'loading' }));
    try {
      const res = await fetch(`/api/rooms/${roomId}/versions/${versionId}/diff`);
      if (!res.ok) throw new Error('diff failed');
      const data = (await res.json()) as { diffs: VersionDiff[] };
      setDiffs((prev) => ({ ...prev, [versionId]: data.diffs }));
    } catch {
      setDiffs((prev) => ({ ...prev, [versionId]: 'error' }));
    }
  }

  if (versions.length === 0) {
    return <Empty>v0 lands here once the sandbox is ready.</Empty>;
  }

  const current = versions[0];

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      <ul>
        {versions.map((v, i) => {
          const isCurrent = v.id === current.id;
          const isV0 = v.versionNumber === 0;
          const diffOpen = diffOpenId === v.id;
          const diffState = diffs[v.id];
          return (
            <li
              key={v.id}
              className={`px-4 py-3 rounded-lg transition-colors ${
                isCurrent
                  ? 'bg-blue-500/[0.08] border border-blue-400/15'
                  : i % 2 === 0
                  ? 'bg-white/[0.025] hover:bg-white/[0.05]'
                  : 'hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-24 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-semibold text-white">v{v.versionNumber}</span>
                    {isCurrent && (
                      <span className="text-[10px] uppercase tracking-wider text-blue-200">
                        current
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/35 tabular-nums mt-0.5">
                    {timeAgo(v.createdAt)}
                  </div>
                  <div className="text-[10px] text-white/25 mt-1">
                    {v.fileCount} files · {humanBytes(v.totalBytes)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/85 leading-snug">{v.summary}</div>

                  {diffOpen && (
                    <div className="mt-3 border-t border-white/8 pt-3">
                      {diffState === 'loading' && (
                        <div className="text-xs text-white/45">Loading diff…</div>
                      )}
                      {diffState === 'error' && (
                        <div className="text-xs text-red-300">Could not load diff.</div>
                      )}
                      {Array.isArray(diffState) && diffState.length === 0 && (
                        <div className="text-xs text-white/45">No file changes.</div>
                      )}
                      {Array.isArray(diffState) && diffState.length > 0 && (
                        <ul className="space-y-1 max-h-48 overflow-y-auto">
                          {diffState.map((d) => (
                            <li key={d.path} className="text-xs flex items-start gap-2 font-mono">
                              <DiffKind kind={d.kind} />
                              <span className="text-white/70 truncate flex-1">{d.path}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isV0 && (
                    <button
                      onClick={() => toggleDiff(v.id)}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/65 hover:text-white hover:bg-white/5"
                    >
                      {diffOpen ? 'Hide diff' : 'Diff'}
                    </button>
                  )}
                  {!isCurrent && isHost && (
                    <button
                      onClick={() => rollback(v.id, `v${v.versionNumber}`)}
                      disabled={rollingBack === v.id}
                      className="rounded-lg border border-blue-400/30 bg-blue-500/15 px-3 py-1.5 text-xs text-blue-100 hover:bg-blue-500/25 disabled:opacity-50"
                    >
                      {rollingBack === v.id ? 'Rolling back…' : 'Rollback'}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DiffKind({ kind }: { kind: VersionDiff['kind'] }) {
  if (kind === 'added')
    return <span className="text-emerald-400 shrink-0">+ added</span>;
  if (kind === 'removed')
    return <span className="text-red-400 shrink-0">- removed</span>;
  return <span className="text-amber-300 shrink-0">~ changed</span>;
}

function ContextContent({ room }: { room: Props['room'] }) {
  const ctx = (room.context ?? {}) as Record<string, unknown>;
  const entries: [string, string][] = [
    ['Title', room.title],
    [
      'Objective',
      (OBJECTIVE_LABELS as Record<string, string>)[room.objective] ?? room.objective,
    ],
    [
      'Output',
      (OUTPUT_TYPE_LABELS as Record<string, string>)[room.outputType] ?? room.outputType,
    ],
  ];
  for (const [k, v] of Object.entries(ctx)) {
    if (!v) continue;
    entries.push([
      camelToLabel(k),
      Array.isArray(v) ? v.join(', ') : String(v),
    ]);
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-[26px] border border-white/10 bg-white/[0.045] p-4">
          <div className="text-xs uppercase tracking-[0.22em] text-white/35">{k}</div>
          <div className="mt-3 text-sm leading-relaxed text-white/68">{v}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-12 text-center text-sm text-white/40">{children}</div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function camelToLabel(s: string): string {
  return s
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
