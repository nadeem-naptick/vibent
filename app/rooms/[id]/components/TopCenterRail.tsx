'use client';

import { Check, GitBranch, MessageSquareText, type LucideIcon } from 'lucide-react';
import { PillButton } from './PillButton';

export type DrawerType = 'transcript' | 'tasks' | 'versions' | 'context';

type Item = { icon: LucideIcon; label: string; key: DrawerType; badge?: number | null };

type Props = {
  badges: Partial<Record<DrawerType, number>>;
  onOpen: (type: DrawerType) => void;
};

export function TopCenterRail({ badges, onOpen }: Props) {
  const items: Item[] = [
    { icon: MessageSquareText, label: 'Transcript', key: 'transcript', badge: badges.transcript || null },
    { icon: Check, label: 'Active tasks', key: 'tasks', badge: badges.tasks || null },
    { icon: GitBranch, label: 'Versions', key: 'versions', badge: badges.versions || null },
  ];

  return (
    <div className="absolute left-1/2 top-3 md:top-5 z-30 -translate-x-1/2 flex items-center gap-2 md:gap-5">
      {items.map(({ icon: Icon, label, key, badge }) => (
        <PillButton
          key={key}
          icon={Icon}
          title={label}
          onClick={() => onOpen(key)}
          badge={badge}
        />
      ))}
    </div>
  );
}
