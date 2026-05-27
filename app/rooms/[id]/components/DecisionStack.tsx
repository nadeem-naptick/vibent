'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wand2, X, PenLine, ChevronsUpDown, Check, Trash2, Brain } from 'lucide-react';
import type { DetectedIntent } from '@/lib/db/mongo';
import { DraftDecisionModal } from './DraftDecisionModal';
import { PillButton } from './PillButton';

type PendingItem = {
  intent: DetectedIntent;
  msLeft: number;
  progress: number;
};

type Props = {
  roomId: string;
  pending: PendingItem[];
  pool: DetectedIntent[];
  threshold: number;
  composing: boolean;
  onRemovePending: (intentId: string) => void;
  onRemoveFromPool: (intentId: string) => void;
  onApplyNow: () => void;
  isHost: boolean;
  thinkingMode: boolean;
  onToggleThinking: () => void;
};

export function DecisionStack({
  roomId,
  pending,
  pool,
  threshold,
  composing,
  onRemovePending,
  onRemoveFromPool,
  onApplyNow,
  isHost,
  thinkingMode,
  onToggleThinking,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const items = [
    ...pending.map((p) => ({
      kind: 'pending' as const,
      id: p.intent.id,
      intent: p.intent,
      progress: p.progress,
      msLeft: p.msLeft,
    })),
    ...pool.map((i) => ({
      kind: 'pool' as const,
      id: i.id,
      intent: i,
    })),
  ];

  const total = pool.length + pending.length;

  function deleteAll() {
    if (!confirm(`Discard all ${total} pending decisions?`)) return;
    for (const p of pending) onRemovePending(p.intent.id);
    for (const i of pool) onRemoveFromPool(i.id);
  }

  return (
    <div className="absolute left-3 right-3 md:right-auto md:left-5 top-24 z-30 md:w-[340px] pointer-events-none">
      {/* Header — same pill size as the bottom toolbar */}
      <div className="pointer-events-auto mb-3 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-5">
        {isHost && (
          <PillButton
            icon={PenLine}
            title="Draft a decision manually"
            onClick={() => setDrafting(true)}
          />
        )}
        <PillButton
          icon={ChevronsUpDown}
          title={expanded ? 'Collapse' : 'Expand'}
          onClick={() => setExpanded((v) => !v)}
          variant={expanded ? 'active' : 'default'}
          badge={total || null}
        />
        {isHost && (
          <PillButton
            icon={Check}
            title={`Apply ${total} now`}
            onClick={onApplyNow}
            variant={items.length === 0 || composing ? 'default' : 'active'}
          />
        )}
        {isHost && (
          <PillButton
            icon={Brain}
            title={
              thinkingMode
                ? 'Thinking mode ON · deeper reasoning, slower'
                : 'Thinking mode OFF · fast, no reasoning'
            }
            onClick={onToggleThinking}
            variant={thinkingMode ? 'active' : 'default'}
          />
        )}
      </div>

      {/* Delete-all bar — only visible when expanded with items */}
      {expanded && items.length > 0 && isHost && (
        <div className="pointer-events-auto mb-3">
          <button
            onClick={deleteAll}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/15 transition-colors"
          >
            <Trash2 size={13} />
            Delete all {total}
          </button>
        </div>
      )}

      {drafting && (
        <DraftDecisionModal
          roomId={roomId}
          thinkingMode={thinkingMode}
          onClose={() => setDrafting(false)}
          onSubmitted={() => setDrafting(false)}
        />
      )}

      {/* Stack */}
      {items.length > 0 && (
        <div
          className="relative pointer-events-auto"
          style={{
            height: expanded
              ? Math.min(items.length * 118, Math.round((typeof window !== 'undefined' ? window.innerHeight : 800) * 0.6))
              : 220,
            overflowY: expanded && items.length > 5 ? 'auto' : 'visible',
          }}
        >
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              animate={{
                y: expanded ? index * 118 : index * 8,
                scale: expanded ? 1 : 1 - index * 0.04,
                opacity: expanded ? 1 : 1 - index * 0.18,
                zIndex: items.length - index,
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="absolute left-0 right-0 rounded-[22px] border border-white/10 bg-black/85 backdrop-blur-2xl p-4 shadow-2xl overflow-hidden"
              style={{ zIndex: items.length - index }}
            >
              {item.kind === 'pending' && (
                <div
                  className="absolute left-0 top-0 h-0.5 bg-white/40 transition-[width] duration-200 ease-linear"
                  style={{ width: `${item.progress * 100}%` }}
                  aria-hidden
                />
              )}
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white/80">
                  <Wand2 size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    {item.kind === 'pending' ? (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/65 tabular-nums shrink-0 font-medium">
                        {(item.msLeft / 1000).toFixed(1)}s
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/65 shrink-0 capitalize font-medium">
                        {item.intent.type.replace(/_/g, ' ')}
                      </span>
                    )}
                    <span className="text-[10px] text-white/35 truncate">
                      {item.intent.speakerName}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-white leading-snug">
                    {item.intent.summary}
                  </div>
                  {(expanded || items.length <= 2) && item.intent.rawText && (
                    <div className="mt-1.5 text-xs leading-relaxed text-white/45 line-clamp-2 italic">
                      &ldquo;{item.intent.rawText}&rdquo;
                    </div>
                  )}
                </div>
                {isHost && (
                  <button
                    onClick={() =>
                      item.kind === 'pending'
                        ? onRemovePending(item.id)
                        : onRemoveFromPool(item.id)
                    }
                    title="Discard"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-red-500/80 hover:text-white transition-colors"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

