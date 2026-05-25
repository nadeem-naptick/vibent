'use client';

import {
  Check,
  GitBranch,
  Layers3,
  MessageSquareText,
  type LucideIcon,
} from 'lucide-react';

export type DrawerType = 'transcript' | 'tasks' | 'versions' | 'context';

type Item = { icon: LucideIcon; label: string; key: DrawerType; badge?: number | null };

type Props = {
  badges: Partial<Record<DrawerType, number>>;
  onOpen: (type: DrawerType) => void;
};

export function SideRail({ badges, onOpen }: Props) {
  const items: Item[] = [
    { icon: MessageSquareText, label: 'Transcript', key: 'transcript', badge: badges.transcript || null },
    { icon: Check, label: 'Active tasks', key: 'tasks', badge: badges.tasks || null },
    { icon: GitBranch, label: 'Versions', key: 'versions', badge: badges.versions || null },
    { icon: Layers3, label: 'Context', key: 'context' },
  ];

  return (
    <div className="absolute right-5 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-3">
      {items.map(({ icon: Icon, label, key, badge }) => (
        <button
          key={key}
          onClick={() => onOpen(key)}
          title={label}
          className="group relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/42 text-white/60 shadow-2xl backdrop-blur-2xl transition-all hover:w-40 hover:justify-start hover:px-4 hover:text-white"
        >
          <Icon size={19} />
          <span className="ml-3 hidden text-sm group-hover:inline whitespace-nowrap">
            {label}
          </span>
          {badge != null && badge > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-semibold text-white">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
