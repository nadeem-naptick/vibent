'use client';

import { useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Info, X } from 'lucide-react';

type Props = {
  // Short text shown on hover.
  label: string;
  // Longer paragraph shown when the user clicks the ⓘ icon. When absent,
  // the tooltip has no info icon — just the label.
  body?: string;
  // The trigger element (typically the actual <button>).
  children: React.ReactNode;
};

/**
 * Hover-tooltip + click-through info popover, in one component.
 *
 * Behavior:
 *   - Cursor enters the child  →  small label popover appears after 500ms.
 *   - Cursor leaves both child and popover →  closes after 200ms.
 *   - If `body` is provided, the label popover gets an ⓘ icon. Click it →
 *     the popover swaps to a wider card with the full body text and stays
 *     open until you click the ✕ or click outside.
 *
 * Implementation: a single Radix Popover (no Tooltip) so we don't have to
 * fight the Tooltip→Popover dismissal interactions when the user moves from
 * label state into expanded state.
 */
export function HelpTooltip({ label, body, children }: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelTimers() {
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
  }

  function handleMouseEnter() {
    cancelTimers();
    if (open) return;
    enterTimerRef.current = setTimeout(() => setOpen(true), 500);
  }

  function handleMouseLeave() {
    cancelTimers();
    // Don't auto-close while expanded — user is reading the explanation.
    if (expanded) return;
    leaveTimerRef.current = setTimeout(() => setOpen(false), 200);
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setExpanded(false);
      }}
    >
      <Popover.Anchor asChild>
        <span
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          // inline-flex keeps the wrapper shrunk to the child so layout
          // doesn't bloat around pills.
          className="inline-flex"
        >
          {children}
        </span>
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="center"
          sideOffset={8}
          // Prevent Radix from yanking focus when expanded card opens —
          // the trigger is a button and the user is still moving the mouse.
          onOpenAutoFocus={(e) => e.preventDefault()}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={[
            'z-50 rounded-xl border border-white/10 bg-slate-950/95 text-white shadow-2xl backdrop-blur-xl',
            expanded ? 'w-72 p-4' : 'px-3 py-1.5',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
          ].join(' ')}
        >
          {expanded && body ? (
            <>
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-sm font-semibold text-white">{label}</h3>
                <button
                  type="button"
                  onClick={() => {
                    setExpanded(false);
                    setOpen(false);
                  }}
                  className="text-white/55 hover:text-white transition-colors shrink-0"
                  aria-label="Close"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="text-[13px] text-white/75 leading-relaxed">{body}</p>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs font-medium whitespace-nowrap">
              <span>{label}</span>
              {body && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setExpanded(true);
                  }}
                  className="text-white/55 hover:text-blue-300 transition-colors"
                  aria-label={`More about ${label}`}
                >
                  <Info size={13} />
                </button>
              )}
            </div>
          )}
          <Popover.Arrow className="fill-slate-950" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
