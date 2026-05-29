'use client';

import { Minimize2 } from 'lucide-react';

type Props = {
  onClick: () => void;
};

// In focus mode the only chrome we render is this peek-edge button. By
// default it's a small dim circle hugging the top-right corner so the
// canvas isn't obstructed. On hover the pill expands leftward, the
// label slides in from the right, and the background turns solid —
// signalling "click me to exit." Press F also exits (handled in
// LiveRoomClient's keyboard listener).
export function ExitFocusPill({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      title="Exit focus mode (F)"
      className="
        group absolute top-4 right-4 z-40
        inline-flex items-center
        h-12 px-3.5 hover:px-5
        rounded-full border border-white/10
        bg-slate-900/55 hover:bg-slate-900/95
        text-white/65 hover:text-white
        shadow-xl hover:shadow-2xl backdrop-blur-md
        transition-all duration-300 ease-out
      "
    >
      <Minimize2 size={20} strokeWidth={2.4} className="shrink-0" />
      <span
        className="
          inline-block overflow-hidden whitespace-nowrap
          max-w-0 group-hover:max-w-[110px]
          group-hover:ml-2
          text-[14px] font-semibold
          opacity-0 group-hover:opacity-100
          transition-all duration-300 ease-out
        "
      >
        Exit focus
      </span>
    </button>
  );
}
