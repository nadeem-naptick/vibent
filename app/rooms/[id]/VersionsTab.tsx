'use client';

import { useState } from 'react';
import type { LiveVersion } from './types';

type Props = {
  roomId: string;
  versions: LiveVersion[];
  isHost: boolean;
  onRolledBack: () => void;
};

export function VersionsTab({ roomId, versions, isHost, onRolledBack }: Props) {
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function rollback(versionId: string, label: string) {
    if (!confirm(`Roll back to ${label}? The current sandbox files will be overwritten with this snapshot.`)) {
      return;
    }
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

  if (versions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <p className="text-sm text-neutral-500 text-center">
          Snapshots appear here as tasks complete. v0 is the initial template.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {error && (
        <div className="m-3 rounded-md border border-red-900 bg-red-950 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
      <ul className="divide-y divide-neutral-900">
        {versions.map((v) => {
          const isCurrent = v.versionNumber === versions[0].versionNumber;
          return (
            <li key={v.id} className="px-4 py-3 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                    isCurrent
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-900'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                  }`}
                >
                  v{v.versionNumber}
                </span>
                {isCurrent && (
                  <span className="text-[10px] text-emerald-400 uppercase tracking-wider">
                    current
                  </span>
                )}
                {v.rolledBackFromVersionId && (
                  <span className="text-[10px] text-amber-400 uppercase tracking-wider">
                    rollback
                  </span>
                )}
                <span className="text-[10px] text-neutral-600">
                  {timeAgo(v.createdAt)} · {v.fileCount} files · {humanBytes(v.totalBytes)}
                </span>
              </div>
              <div className="text-sm text-neutral-200 leading-snug">{v.summary}</div>
              {isHost && !isCurrent && (
                <div>
                  <button
                    onClick={() => rollback(v.id, `v${v.versionNumber}`)}
                    disabled={rollingBack === v.id}
                    className="text-xs text-neutral-400 hover:text-neutral-100 underline underline-offset-4 disabled:opacity-50"
                  >
                    {rollingBack === v.id ? 'Rolling back…' : 'Rollback to this version'}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
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
