'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { DrawerType } from './SideRail';
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
  return (
    <AnimatePresence>
      {type && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-5 left-5 right-5 max-h-[78vh] flex flex-col rounded-[36px] border border-white/12 bg-[#0B0F14]/94 p-5 shadow-2xl backdrop-blur-2xl"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-white">{TITLES[type]}</div>
                <div className="text-sm text-white/42">{SUBTITLES[type]}</div>
              </div>
              <button
                onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-2xl bg-white/8 text-white/65 hover:bg-white/12"
              >
                <ChevronDown size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto -mx-1 px-1">
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
    </AnimatePresence>
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
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {transcripts.map((s) => (
        <div
          key={s.id}
          className="rounded-[26px] border border-white/10 bg-white/[0.045] p-4"
        >
          <div className="mb-2 text-sm font-semibold text-blue-200">{s.speakerName}</div>
          <p className="text-sm leading-relaxed text-white/55">{s.text}</p>
        </div>
      ))}
    </div>
  );
}

function TasksContent({ tasks }: { tasks: LiveTask[] }) {
  if (tasks.length === 0) {
    return <Empty>Compose a decision and tasks appear here.</Empty>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {tasks.map((t) => (
        <div key={t.id} className="rounded-[26px] border border-white/10 bg-white/[0.045] p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] capitalize ${
                t.status === 'complete'
                  ? 'bg-emerald-500/10 text-emerald-200'
                  : t.status === 'running'
                  ? 'bg-blue-500/10 text-blue-200 animate-pulse'
                  : t.status === 'failed'
                  ? 'bg-red-500/10 text-red-200'
                  : 'bg-white/5 text-white/55'
              }`}
            >
              {t.status === 'running' ? 'running…' : t.status}
            </span>
            <span className="text-[11px] text-white/30">{t.model?.split('/').pop()}</span>
          </div>
          <p className="text-sm font-medium text-white leading-snug">{t.instruction}</p>
          {t.summary && (
            <p className="mt-2 text-xs text-white/45 italic leading-relaxed">{t.summary}</p>
          )}
          {t.error && (
            <p className="mt-2 text-xs text-red-300 font-mono leading-snug">{t.error}</p>
          )}
        </div>
      ))}
    </div>
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
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {versions.map((v) => {
          const isCurrent = v.id === current.id;
          const isV0 = v.versionNumber === 0;
          const diffOpen = diffOpenId === v.id;
          const diffState = diffs[v.id];
          return (
            <div
              key={v.id}
              className={`rounded-[26px] border p-4 ${
                isCurrent
                  ? 'border-blue-400/25 bg-blue-500/10'
                  : 'border-white/10 bg-white/[0.045]'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xl font-semibold text-white">v{v.versionNumber}</div>
                <div className="text-xs text-white/38">{timeAgo(v.createdAt)}</div>
              </div>
              <div className="text-sm text-white/65 line-clamp-3 leading-snug min-h-[3em]">{v.summary}</div>
              <div className="mt-2 text-[10px] text-white/30">
                {v.fileCount} files · {humanBytes(v.totalBytes)}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {!isV0 && (
                  <button
                    onClick={() => toggleDiff(v.id)}
                    className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/65 hover:text-white hover:bg-white/5"
                  >
                    {diffOpen ? 'Hide diff' : 'View diff'}
                  </button>
                )}
                {!isCurrent && isHost && (
                  <button
                    onClick={() => rollback(v.id, `v${v.versionNumber}`)}
                    disabled={rollingBack === v.id}
                    className="flex-1 rounded-xl border border-blue-400/30 bg-blue-500/15 px-3 py-1.5 text-xs text-blue-100 hover:bg-blue-500/25 disabled:opacity-50"
                  >
                    {rollingBack === v.id ? 'Rolling back…' : 'Rollback'}
                  </button>
                )}
                {isCurrent && (
                  <span className="flex-1 text-center text-xs text-blue-200 py-1.5">Current</span>
                )}
              </div>

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
          );
        })}
      </div>
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
