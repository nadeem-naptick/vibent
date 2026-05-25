'use client';

import { useEffect, useState } from 'react';
import type { DetectedIntent } from '@/lib/db/mongo';

type Props = {
  roomId: string;
  selected: DetectedIntent[];
  onRemove: (intentId: string) => void;
  onClose: () => void;
  onSubmitted: () => void;
};

export function ComposeDecisionModal({
  roomId,
  selected,
  onRemove,
  onClose,
  onSubmitted,
}: Props) {
  const [instruction, setInstruction] = useState('');
  const [composing, setComposing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-compose on open. Re-runs whenever the selection changes.
  useEffect(() => {
    if (selected.length === 0) return;
    let cancelled = false;
    setComposing(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch('/api/intel/compose-decision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, intentIds: selected.map((s) => s.id) }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `compose failed (${res.status})`);
        }
        const { instruction: ai } = (await res.json()) as { instruction: string };
        if (!cancelled) setInstruction(ai);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'compose failed');
      } finally {
        if (!cancelled) setComposing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, selected]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/decisions/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          intentIds: selected.map((s) => s.id),
          instruction,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `submit failed (${res.status})`);
      }
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit failed');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="bg-neutral-950 border border-neutral-800 rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
        <header className="px-5 py-3 border-b border-neutral-900 flex items-center justify-between">
          <h2 className="text-sm font-medium">Compose decision</h2>
          <button
            onClick={onClose}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            Cancel
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Selected detections */}
          <section>
            <p className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
              From {selected.length} detection{selected.length === 1 ? '' : 's'}
            </p>
            <ul className="space-y-2">
              {selected.map((d) => (
                <li
                  key={d.id}
                  className="flex items-start gap-2 text-xs text-neutral-400 rounded border border-neutral-900 bg-neutral-950 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-0.5">
                      {d.type.replace(/_/g, ' ')} · {d.speakerName}
                    </div>
                    <div className="leading-snug text-neutral-300">{d.summary}</div>
                    <div className="text-neutral-600 italic leading-snug mt-1">
                      "{d.rawText}"
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(d.id)}
                    title="Remove from this decision"
                    className="text-neutral-600 hover:text-red-400 text-base leading-none"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* AI-merged instruction (editable) */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase tracking-wider text-neutral-500">
                Instruction for the execution agent
              </p>
              {composing && (
                <span className="text-xs text-neutral-500">composing…</span>
              )}
            </div>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={composing}
              rows={6}
              placeholder={composing ? '' : 'The AI couldn’t compose — type the instruction yourself.'}
              className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600 disabled:opacity-50"
            />
            <p className="text-[11px] text-neutral-600 mt-1">
              The agent will read this exactly. Edit freely — constraints and
              guardrails belong here too.
            </p>
          </section>

          {error && (
            <div className="rounded-md border border-red-900 bg-red-950 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-neutral-900 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="text-xs text-neutral-500 hover:text-neutral-300 px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            disabled={composing || submitting || instruction.trim().length < 5}
            onClick={submit}
            className="text-xs rounded bg-neutral-100 text-neutral-950 px-4 py-1.5 font-medium hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Queueing…' : 'Apply'}
          </button>
        </footer>
      </div>
    </div>
  );
}
