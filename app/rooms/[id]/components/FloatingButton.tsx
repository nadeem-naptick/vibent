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
      className={`group flex items-center gap-2.5 rounded-full border-2 px-5 py-3.5 text-sm font-medium shadow-2xl backdrop-blur-2xl transition ${
        active
          ? 'border-blue-400/50 bg-blue-500/25 text-blue-50'
          : 'border-white/20 bg-slate-950/70 text-white/80 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon size={20} />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
