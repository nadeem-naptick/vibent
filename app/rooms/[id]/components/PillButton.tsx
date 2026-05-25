'use client';

import type { LucideIcon } from 'lucide-react';

type Variant = 'default' | 'active' | 'danger' | 'primary';

type Props = {
  icon: LucideIcon;
  label?: string;
  title: string;
  onClick?: () => void;
  variant?: Variant;
  badge?: number | null;
};

const VARIANT_STYLES: Record<Variant, string> = {
  default:
    'border-white/10 bg-slate-900/85 text-white/85 hover:bg-slate-800 hover:text-white',
  active:
    'border-blue-400/40 bg-blue-500/25 text-blue-50 hover:bg-blue-500/35',
  danger:
    'border-red-400/50 bg-red-500/80 text-white hover:bg-red-500',
  primary:
    'border-transparent bg-white text-neutral-950 hover:bg-blue-50',
};

// Single Meet-style pill used across all chrome (TopCenterRail,
// ParticipantToolbar, DeviceToggle, BottomActionCluster). Square when no
// label is provided; rounded pill that grows to fit when a label is set.
// Fixed h-14 (56px) so they always vertically align regardless of label.
export function PillButton({
  icon: Icon,
  label,
  title,
  onClick,
  variant = 'default',
  badge,
}: Props) {
  const hasLabel = Boolean(label);
  // 1.2x from base h-14 / w-14 / size=22 → h-[67px] / w-[67px] / size=26
  const sizing = hasLabel ? 'px-6' : 'w-[67px]';
  return (
    <button
      onClick={onClick}
      title={title}
      className={`relative inline-flex h-[67px] shrink-0 items-center justify-center gap-3 rounded-full border shadow-2xl backdrop-blur-2xl transition-colors ${sizing} ${VARIANT_STYLES[variant]}`}
    >
      <Icon size={26} strokeWidth={2} />
      {hasLabel && <span className="text-base font-semibold whitespace-nowrap">{label}</span>}
      {badge != null && badge > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-[11px] font-semibold text-white shadow-lg">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

// Keep IconPill as a thin alias so callers that don't need a label read
// nicely — same component, just without the label prop.
export const IconPill = PillButton;
