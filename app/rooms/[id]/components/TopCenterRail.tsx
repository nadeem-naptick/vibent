'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, GitBranch, Layers3, MessageSquareText, X, type LucideIcon } from 'lucide-react';
import { PillButton } from './PillButton';

export type DrawerType = 'transcript' | 'tasks' | 'versions' | 'context';

type Item = { icon: LucideIcon; label: string; key: DrawerType; badge?: number | null };

type Props = {
  badges: Partial<Record<DrawerType, number>>;
  onOpen: (type: DrawerType) => void;
};

// Bottom-left collapsible feed menu. Default: a single Layers trigger
// with a roll-up badge (sum of unseen items across all three drawers).
// Click to expand: the three pills (Transcript / Active tasks / Versions)
// stack vertically above the trigger. Click any pill to open its drawer
// (and auto-collapse). Click outside or hit the trigger again to close
// without selecting.
export function TopCenterRail({ badges, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const items: Array<Item & { helpBody: string }> = [
    {
      icon: MessageSquareText,
      label: 'Transcript',
      key: 'transcript',
      badge: badges.transcript || null,
      helpBody:
        'Live captions of everyone in the room. Speaker-labeled and searchable. The transcript is what the AI processes to detect intents — if you want to keep something out of the transcript, hit Vibe off first.',
    },
    {
      icon: Check,
      label: 'Active tasks',
      key: 'tasks',
      badge: badges.tasks || null,
      helpBody:
        'What the AI is currently doing or recently did. Each task includes the instruction it received, the model used, and a log of every action it took inside the sandbox.',
    },
    {
      icon: GitBranch,
      label: 'Versions',
      key: 'versions',
      badge: badges.versions || null,
      helpBody:
        'Every snapshot of the artifact, in order. You can preview any past version, restore to it, or diff between two.',
    },
  ];

  // Roll-up badge so the host can see at-a-glance whether there's anything
  // worth opening without having to expand the menu.
  const totalBadge =
    (badges.transcript ?? 0) + (badges.tasks ?? 0) + (badges.versions ?? 0) || null;

  // Click outside closes the menu.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div
      ref={wrapRef}
      // flex-col-reverse puts the trigger at the bottom (first JSX child
      // becomes the last visual child); the expanded pills stack above it.
      className="absolute bottom-4 md:bottom-6 left-4 md:left-6 z-30 flex flex-col-reverse items-start gap-3 md:gap-5"
    >
      <PillButton
        icon={open ? X : Layers3}
        title={open ? 'Close feed menu' : `Feed${totalBadge ? ` (${totalBadge})` : ''}`}
        helpBody="Opens the room feed: transcript, active tasks, and version history. Each opens a side drawer with full details. The badge shows the total of new items across all three."
        onClick={() => setOpen((v) => !v)}
        variant={open ? 'active' : 'default'}
        badge={!open ? totalBadge : null}
      />
      {open &&
        items.map(({ icon: Icon, label, key, badge, helpBody }) => (
          <PillButton
            key={key}
            icon={Icon}
            title={label}
            helpBody={helpBody}
            onClick={() => {
              onOpen(key);
              setOpen(false);
            }}
            badge={badge}
          />
        ))}
    </div>
  );
}
