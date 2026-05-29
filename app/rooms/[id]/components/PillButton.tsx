'use client';

import type { LucideIcon } from 'lucide-react';
import { HelpTooltip } from './HelpTooltip';

type Variant = 'default' | 'active' | 'danger' | 'primary';

type Props = {
  icon: LucideIcon;
  label?: string;
  title: string;
  // Longer paragraph shown when the user clicks the ⓘ icon inside the
  // hover tooltip. Skip on pills that are fully self-explanatory.
  helpBody?: string;
  onClick?: () => void;
  variant?: Variant;
  badge?: number | null;
};

const VARIANT_STYLES: Record<Variant, string> = {
  default:
    'border-white/10 bg-slate-900/85 text-white/85 hover:bg-slate-800 hover:text-white',
  active: 'border-blue-400/40 bg-blue-500/25 text-blue-50 hover:bg-blue-500/35',
  danger: 'border-red-400/50 bg-red-500/80 text-white hover:bg-red-500',
  primary: 'border-transparent bg-white text-neutral-950 hover:bg-blue-50',
};

// Single Meet-style pill used across all chrome. Auto-responsive:
//   - Mobile (< md): h-14 (56px), icon size 22 — comfortable tap target,
//     doesn't blow up the layout
//   - Desktop (≥ md): h-[67px], icon size 26 — original chrome size
//
// `[&_svg]` selector overrides the inline width/height that lucide-react
// puts on the SVG element, so the responsive sizing actually wins.
export function PillButton({
  icon: Icon,
  label,
  title,
  helpBody,
  onClick,
  variant = 'default',
  badge,
}: Props) {
  const hasLabel = Boolean(label);
  const sizing = hasLabel ? 'px-4 md:px-6' : 'w-[56px] md:w-[67px]';
  return (
    <HelpTooltip label={title} body={helpBody}>
      <button
        onClick={onClick}
        // aria-label keeps the accessible name even when we hide the
        // native title attribute (which would double up with the custom
        // tooltip on hover).
        aria-label={title}
        className={`relative inline-flex h-[56px] md:h-[67px] shrink-0 items-center justify-center gap-2 md:gap-3 rounded-full border shadow-2xl backdrop-blur-2xl transition-colors [&>svg]:!w-[22px] [&>svg]:!h-[22px] md:[&>svg]:!w-[26px] md:[&>svg]:!h-[26px] ${sizing} ${VARIANT_STYLES[variant]}`}
      >
        <Icon size={26} strokeWidth={2} />
        {hasLabel && (
          <span className="text-sm md:text-base font-semibold whitespace-nowrap">{label}</span>
        )}
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-[11px] font-semibold text-white shadow-lg">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>
    </HelpTooltip>
  );
}

// Keep IconPill as a thin alias so callers that don't need a label read
// nicely — same component, just without the label prop.
export const IconPill = PillButton;
