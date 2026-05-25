'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

type Props = {
  roomId: string;
  onClose: () => void;
  onSubmitted: () => void;
};

export function DraftDecisionModal({ roomId, onClose, onSubmitted }: Props) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // Autofocus on open
  useEffect(() => {
    taRef.current?.focus();
  }, []);

  // Cmd+Enter submits
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
  }

  async function submit() {
    console.log('[draft-decision] submit clicked, text length:', text.trim().length);
    const instruction = text.trim();
    if (instruction.length < 5) {
      toast.error('Decision needs at least 5 characters');
      return;
    }
    setSubmitting(true);
    try {
      console.log('[draft-decision] posting to /api/decisions/compose');
      const res = await fetch('/api/decisions/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          intentIds: [],
          instruction,
        }),
      });
      console.log('[draft-decision] response status:', res.status);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `submit failed (${res.status})`);
      }
      toast.success('Decision queued');
      onSubmitted();
    } catch (err) {
      console.error('[draft-decision] submit failed:', err);
      toast.error(err instanceof Error ? err.message : 'submit failed');
      setSubmitting(false);
    }
  }

  // Render via portal so the modal isn't a child of DecisionStack — which
  // has pointer-events:none and would swallow all clicks otherwise.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] pointer-events-auto bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-[28px] border border-white/12 bg-[#0B0F14]/95 shadow-2xl backdrop-blur-2xl flex flex-col"
      >
        <header className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Draft a decision</div>
            <div className="text-xs text-white/45">
              Write or paste the instruction. Goes straight to the execution agent.
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-white/45 hover:text-white px-2"
          >
            ✕
          </button>
        </header>

        <div className="p-5">
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={8}
            placeholder="e.g. Add a pricing section below the hero with three plans: Starter, Pro, Team. Use Tailwind grid. Keep the existing hero unchanged."
            className="w-full rounded-2xl bg-white/[0.03] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-blue-400/50 resize-none"
          />
          <p className="mt-2 text-[11px] text-white/35">
            ⌘+Enter to submit
          </p>
        </div>

        <footer className="px-5 py-3 border-t border-white/8 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm text-white/55 hover:text-white px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-xl bg-white text-neutral-950 px-4 py-1.5 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Queueing…' : 'Apply'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
