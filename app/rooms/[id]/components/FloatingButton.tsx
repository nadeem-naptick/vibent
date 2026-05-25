'use client';

import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
  title?: string;
};

export function FloatingButton({ icon: Icon, label, active, onClick, title }: Props) {
  return (
    <button
      onClick={onClick}
      title={title ?? label}
      className={`group flex items-center gap-2 rounded-full border px-4 py-3 text-sm shadow-2xl backdrop-blur-2xl transition ${
        active
          ? 'border-blue-400/40 bg-blue-500/18 text-blue-50'
          : 'border-white/10 bg-slate-950/40 text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon size={17} />
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}
