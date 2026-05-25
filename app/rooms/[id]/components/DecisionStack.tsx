'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wand2, X } from 'lucide-react';
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
  isHost: boolean;
};

export function DecisionStack({
  pending,
  pool,
  threshold,
  composing,
  onRemovePending,
  onRemoveFromPool,
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

  // Don't render if nothing to show
  if (items.length === 0 && !composing) return null;

  const total = pool.length + pending.length;
  const headline = composing
    ? 'Submitting decision…'
    : `${total} waiting · auto-bundles at ${threshold}`;

  return (
    <div className="absolute left-5 top-1/2 z-30 w-[340px] -translate-y-1/2 pointer-events-none">
      {/* Header */}
      <div className="pointer-events-auto mb-3 flex items-center justify-between rounded-[22px] border border-amber-300/20 bg-[#16100A]/72 px-4 py-3 shadow-2xl backdrop-blur-2xl">
        <div>
          <div className="text-sm font-semibold text-white">
            {composing ? 'Composing decision' : 'Next decisions detected'}
          </div>
          <div className="text-xs text-white/42">{headline}</div>
        </div>
        {items.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:text-white"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>

      {/* Stack */}
      {items.length > 0 && (
        <div
          className="relative pointer-events-auto"
          style={{ height: expanded ? items.length * 118 : 220 }}
        >
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              animate={{
                y: expanded ? index * 118 : index * 14,
                scale: expanded ? 1 : 1 - index * 0.035,
                opacity: expanded ? 1 : 1 - index * 0.12,
                zIndex: items.length - index,
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="absolute left-0 right-0 rounded-[26px] border border-amber-300/20 bg-[#16100A]/82 p-4 shadow-2xl backdrop-blur-2xl overflow-hidden"
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
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-300/15 text-amber-200">
                  <Wand2 size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold text-white">
                      {item.intent.summary}
                    </div>
                    {item.kind === 'pending' ? (
                      <span className="rounded-full bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-100 tabular-nums shrink-0">
                        {(item.msLeft / 1000).toFixed(1)}s
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-100 shrink-0 capitalize">
                        {item.intent.type.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-white/55 line-clamp-2">
                    {item.intent.rawText
                      ? `"${item.intent.rawText}"`
                      : item.intent.summary}
                  </div>
                  {expanded && (
                    <div className="mt-2 text-[11px] text-white/40">
                      {item.intent.speakerName} ·{' '}
                      {(item.intent.confidence * 100).toFixed(0)}% confidence
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
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-white/50 hover:text-white"
                  >
                    <X size={13} />
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
