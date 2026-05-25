'use client';

import { Minimize2 } from 'lucide-react';
import { PillButton } from './PillButton';

type Props = {
  onClick: () => void;
};

// Renders only while focusMode is active. Top-right corner so it doesn't
// fight any other chrome (everything else is hidden).
export function ExitFocusPill({ onClick }: Props) {
  return (
    <div className="absolute top-5 right-5 z-40">
      <PillButton
        icon={Minimize2}
        label="Exit focus"
        title="Exit focus mode (F)"
        onClick={onClick}
      />
    </div>
  );
}
