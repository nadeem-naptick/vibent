'use client';

import { Monitor, Tablet, Smartphone } from 'lucide-react';
import type { DeviceFrame } from '../useSettings';
import { PillButton } from './PillButton';

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
    <div className="absolute bottom-6 left-6 z-30 flex items-center gap-3">
      {FRAMES.map(({ id, icon: Icon, label }) => {
        const active = value === id;
        return (
          <PillButton
            key={id}
            icon={Icon}
            label={active ? label : undefined}
            title={label}
            onClick={() => onChange(id)}
            variant={active ? 'active' : 'default'}
          />
        );
      })}
    </div>
  );
}
