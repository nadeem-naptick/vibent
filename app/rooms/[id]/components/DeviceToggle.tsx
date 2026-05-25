'use client';

import { Monitor, Tablet, Smartphone } from 'lucide-react';
import type { DeviceFrame } from '../useSettings';

type Props = {
  value: DeviceFrame;
  onChange: (v: DeviceFrame) => void;
};

const FRAMES: { id: DeviceFrame; icon: typeof Monitor; label: string }[] = [
  { id: 'desktop', icon: Monitor, label: 'Desktop' },
  { id: 'tablet', icon: Tablet, label: 'Tablet' },
  { id: 'mobile', icon: Smartphone, label: 'Mobile' },
];

export function DeviceToggle({ value, onChange }: Props) {
  return (
    <div className="absolute bottom-6 left-6 z-30 flex items-center gap-1 rounded-2xl border-2 border-white/20 bg-slate-950/70 p-1 shadow-2xl backdrop-blur-2xl">
      {FRAMES.map(({ id, icon: Icon, label }) => {
        const active = value === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            title={label}
            className={`grid h-11 place-items-center rounded-xl transition-all px-3 ${
              active
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/40'
                : 'w-11 text-white/55 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Icon size={18} />
              {active && <span className="text-xs font-medium">{label}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
