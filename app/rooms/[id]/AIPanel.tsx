'use client';

import { useMemo, useState } from 'react';
import type { DetectedIntent, IntentType, TranscriptSegment } from '@/lib/db/mongo';

type Tab = 'transcript' | 'detected' | 'decisions' | 'applied' | 'open';

const TAB_LABELS: Record<Tab, string> = {
  transcript: 'Transcript',
  detected: 'Detected',
  decisions: 'Decisions',
  applied: 'Applied',
  open: 'Open',
};

type Props = {
  transcripts: TranscriptSegment[];
  intents: DetectedIntent[];
  isHost: boolean;
  onUpdateIntent: (intentId: string, patch: { status: DetectedIntent['status'] }) => void;
};

export function AIPanel({ transcripts, intents, isHost, onUpdateIntent }: Props) {
  const [tab, setTab] = useState<Tab>('detected');

  const grouped = useMemo(() => groupIntents(intents), [intents]);

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-100">
      <div className="border-b border-neutral-900">
        <nav className="flex">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
            const count = tabCount(t, transcripts, grouped);
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-2 py-2 text-xs uppercase tracking-wider border-b-2 transition-colors ${
                  tab === t
                    ? 'border-neutral-100 text-neutral-100'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {TAB_LABELS[t]}
                {count !== null && (
                  <span className="ml-1 text-[10px] text-neutral-600">{count}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'transcript' && <TranscriptList transcripts={transcripts} />}
        {tab === 'detected' && (
          <IntentList
            intents={grouped.detected}
            empty="No detected ideas or constraints yet."
            renderActions={null}
          />
        )}
        {tab === 'decisions' && (
          <IntentList
            intents={grouped.pendingDecisions}
            empty="No pending decisions."
            renderActions={(intent) =>
              isHost ? (
                <div className="flex gap-2 mt-2">
                  <ActionButton
                    onClick={() => onUpdateIntent(intent.id, { status: 'approved' })}
                    variant="primary"
                  >
                    Apply
                  </ActionButton>
                  <ActionButton
                    onClick={() => onUpdateIntent(intent.id, { status: 'ignored' })}
                  >
                    Ignore
                  </ActionButton>
                </div>
              ) : null
            }
          />
        )}
        {tab === 'applied' && (
          <IntentList intents={grouped.applied} empty="Nothing applied yet." renderActions={null} />
        )}
        {tab === 'open' && (
          <IntentList
            intents={grouped.openQuestions}
            empty="No open questions."
            renderActions={null}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TranscriptList({ transcripts }: { transcripts: TranscriptSegment[] }) {
  if (transcripts.length === 0) {
    return <Empty>Transcript will appear here as participants speak.</Empty>;
  }
  return (
    <ul className="divide-y divide-neutral-900">
      {transcripts.map((s) => (
        <li key={s.id} className="px-4 py-2.5 text-sm">
          <div className="text-xs text-neutral-500 mb-0.5">{s.speakerName}</div>
          <div className="text-neutral-200 leading-snug">{s.text}</div>
        </li>
      ))}
    </ul>
  );
}

function IntentList({
  intents,
  empty,
  renderActions,
}: {
  intents: DetectedIntent[];
  empty: string;
  renderActions: ((intent: DetectedIntent) => React.ReactNode) | null;
}) {
  if (intents.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-neutral-900">
      {intents.map((intent) => (
        <li key={intent.id} className="px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <TypeBadge type={intent.type} />
            <span className="text-[11px] text-neutral-500">
              {intent.speakerName} · {(intent.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="text-sm text-neutral-200 leading-snug">{intent.summary}</div>
          <div className="text-xs text-neutral-600 mt-1 italic">"{intent.rawText}"</div>
          {renderActions?.(intent)}
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <p className="text-sm text-neutral-500 text-center">{children}</p>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary';
}) {
  const base = 'text-xs px-3 py-1 rounded font-medium transition-colors';
  const styles =
    variant === 'primary'
      ? 'bg-neutral-100 text-neutral-950 hover:bg-white'
      : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800 border border-neutral-800';
  return (
    <button onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

const TYPE_COLORS: Record<IntentType, string> = {
  idea: 'bg-blue-950 text-blue-300 border-blue-900',
  question: 'bg-purple-950 text-purple-300 border-purple-900',
  decision: 'bg-emerald-950 text-emerald-300 border-emerald-900',
  instruction: 'bg-amber-950 text-amber-300 border-amber-900',
  correction: 'bg-orange-950 text-orange-300 border-orange-900',
  rejected_idea: 'bg-neutral-900 text-neutral-500 border-neutral-800',
  open_question: 'bg-violet-950 text-violet-300 border-violet-900',
  constraint: 'bg-rose-950 text-rose-300 border-rose-900',
  action_item: 'bg-cyan-950 text-cyan-300 border-cyan-900',
  reference: 'bg-indigo-950 text-indigo-300 border-indigo-900',
  approved_execution_task: 'bg-emerald-900 text-emerald-200 border-emerald-700',
  noise: 'bg-neutral-900 text-neutral-600 border-neutral-800',
};

function TypeBadge({ type }: { type: IntentType }) {
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${TYPE_COLORS[type]}`}
    >
      {type.replace(/_/g, ' ')}
    </span>
  );
}

// ---------------------------------------------------------------------------

type Grouped = {
  detected: DetectedIntent[];
  pendingDecisions: DetectedIntent[];
  applied: DetectedIntent[];
  openQuestions: DetectedIntent[];
};

function groupIntents(intents: DetectedIntent[]): Grouped {
  const detected: DetectedIntent[] = [];
  const pendingDecisions: DetectedIntent[] = [];
  const applied: DetectedIntent[] = [];
  const openQuestions: DetectedIntent[] = [];

  for (const i of intents) {
    if (i.type === 'open_question' && i.status === 'pending_approval') {
      openQuestions.push(i);
      continue;
    }
    if (i.status === 'applied' || i.status === 'approved') {
      applied.push(i);
      continue;
    }
    if (i.shouldExecute || i.type === 'decision' || i.type === 'instruction' || i.type === 'approved_execution_task') {
      if (i.status === 'pending_approval') {
        pendingDecisions.push(i);
        continue;
      }
    }
    if (i.status === 'pending_approval' && i.type !== 'noise') {
      detected.push(i);
    }
  }
  return { detected, pendingDecisions, applied, openQuestions };
}

function tabCount(tab: Tab, transcripts: TranscriptSegment[], grouped: Grouped) {
  switch (tab) {
    case 'transcript':
      return transcripts.length || null;
    case 'detected':
      return grouped.detected.length || null;
    case 'decisions':
      return grouped.pendingDecisions.length || null;
    case 'applied':
      return grouped.applied.length || null;
    case 'open':
      return grouped.openQuestions.length || null;
  }
}
