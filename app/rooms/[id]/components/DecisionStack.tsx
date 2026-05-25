'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wand2, X, Sparkles } from 'lucide-react';
import type { DetectedIntent } from '@/lib/db/mongo';

type PendingItem = {
  intent: DetectedIntent;
  msLeft: number;
  progress: number;
};

type Props = {
  pending: PendingItem[];
  pool: DetectedIntent[];
  threshold: number;
  composing: boolean;
  onRemovePending: (intentId: string) => void;
  onRemoveFromPool: (intentId: string) => void;
  onApplyNow: () => void;
  isHost: boolean;
};

export function DecisionStack({
  pending,
  pool,
  threshold,
  composing,
  onRemovePending,
  onRemoveFromPool,
  onApplyNow,
  isHost,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  // Combine pending (newest, with countdown) and pool (already locked) into one
  // visual stack. Pending live at the front of the stack visually.
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
  const isEmpty = items.length === 0 && !composing;
  const headline = composing
    ? 'Submitting decision…'
    : isEmpty
    ? 'Listening · speak to detect intent'
    : `${total} waiting · auto-bundles at ${threshold}`;

  return (
    <div className="absolute left-5 top-24 z-30 w-[340px] pointer-events-none">
      {/* Header */}
      <div className="pointer-events-auto mb-3 rounded-[22px] border border-amber-400/30 bg-[#1A1209]/95 shadow-2xl backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0 flex items-center gap-2.5">
            {isEmpty && (
              <Sparkles size={16} className="text-amber-300/70 shrink-0 animate-pulse" />
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">
                {composing ? 'Composing decision' : 'Next decisions'}
              </div>
              <div className="text-xs text-amber-200/60 truncate">{headline}</div>
            </div>
          </div>
          {items.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="shrink-0 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-300/20"
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          )}
        </div>
        {isHost && items.length > 0 && !composing && (
          <div className="border-t border-amber-400/20 px-4 py-2.5">
            <button
              onClick={onApplyNow}
              className="w-full rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950 shadow-lg shadow-amber-500/30 hover:bg-amber-300 transition-colors"
            >
              Apply {total} now →
            </button>
          </div>
        )}
      </div>

      {/* Stack — capped at 60vh when expanded, scrollable beyond */}
      {items.length > 0 && (
        <div
          className="relative pointer-events-auto"
          style={{
            height: expanded
              ? Math.min(items.length * 118, Math.round(window?.innerHeight * 0.6 || 600))
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
              className="absolute left-0 right-0 rounded-[22px] border border-amber-400/30 bg-[#1A1209]/97 p-4 shadow-2xl backdrop-blur-2xl overflow-hidden"
              style={{ zIndex: items.length - index }}
            >
              {/* Countdown progress bar (only for pending items) */}
              {item.kind === 'pending' && (
                <div
                  className="absolute left-0 top-0 h-0.5 bg-amber-300/80 transition-[width] duration-200 ease-linear"
                  style={{ width: `${item.progress * 100}%` }}
                  aria-hidden
                />
              )}

              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-300">
                  <Wand2 size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    {item.kind === 'pending' ? (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-200 tabular-nums shrink-0 font-medium">
                        {(item.msLeft / 1000).toFixed(1)}s
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-200 shrink-0 capitalize font-medium">
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
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
                  >
                    <X size={12} />
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
