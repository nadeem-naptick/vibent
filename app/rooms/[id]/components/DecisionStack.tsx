'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wand2, X, Inbox, Check, Trash2 } from 'lucide-react';
import type { DetectedIntent } from '@/lib/db/mongo';
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
}: Props) {
  const [expanded, setExpanded] = useState(false);

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
    <div className="absolute left-3 right-3 md:right-auto md:left-[100px] top-24 md:top-4 z-30 md:w-[340px] pointer-events-none">
      {/* Header — only renders when there are detections.
          Collapsed: just the chevron pill with count badge.
          Expanded:  chevron + Apply + Delete-all (red icon pill). */}
      {total > 0 && (
        <div className="pointer-events-auto mb-3 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-5">
          <PillButton
            icon={Inbox}
            title={expanded ? 'Collapse detections' : `${total} detection${total === 1 ? '' : 's'} ready`}
            helpBody="Detected intents waiting to compose into a decision. The room watches your conversation for things like 'add a button' or 'change the color'. Once enough related intents pool together, they auto-compose into a decision you can apply."
            onClick={() => setExpanded((v) => !v)}
            variant={expanded ? 'active' : 'default'}
            badge={total || null}
          />
          {expanded && isHost && (
            <>
              <PillButton
                icon={Check}
                title={`Apply ${total} now`}
                helpBody="Skip the threshold and compose a decision from whatever is currently in the pool right now. Useful when the room has clearly agreed and you don't want to wait for the auto-compose."
                onClick={onApplyNow}
                variant={composing ? 'default' : 'active'}
              />
              <PillButton
                icon={Trash2}
                title={`Delete all ${total}`}
                helpBody="Discard every detection in the pool. Stops anything from forming a decision. Useful when the conversation went off-topic and the pool is full of noise."
                onClick={deleteAll}
                variant="danger"
              />
            </>
          )}
        </div>
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

