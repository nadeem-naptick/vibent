'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { toast } from 'sonner';
import { UserPlus, Mail, Copy, Check, X } from 'lucide-react';
import { FaWhatsapp, FaSlack } from 'react-icons/fa';

// "+ Invite" tile that sits at the end of the video tile row. Matches the
// 160×100 ParticipantTile geometry so it reads as a participant slot. Click
// opens a small popover with the room URL pre-formatted for Slack / Email /
// WhatsApp / clipboard.
export function InviteTile() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Use the live URL — works in dev, in prod, on any branded subdomain.
  const url =
    typeof window !== 'undefined'
      ? window.location.origin + window.location.pathname
      : '';

  const message = `I'm hosting a vibemtg room — drop in and let's build something together: ${url}`;
  const slackMessage = `:wave: Join my vibemtg room and let's build something live: ${url}`;

  const emailHref = `mailto:?subject=${encodeURIComponent('Join my vibemtg room')}&body=${encodeURIComponent(message)}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(message)}`;

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Room link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — your browser blocked it');
    }
  }

  async function copySlackMessage() {
    try {
      await navigator.clipboard.writeText(slackMessage);
      toast.success('Slack-ready message copied — paste in any channel');
      setOpen(false);
    } catch {
      toast.error('Could not copy — your browser blocked it');
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Invite people"
          // Mirrors ParticipantTile's size + radius so it reads as a slot
          // in the same row. Outer outline stays subtle (white at low
          // opacity), and a small dark inner pill keeps the icon + label
          // legible against any artifact background.
          className="group relative flex items-center justify-center rounded-[20px] border border-dashed border-white/40 bg-transparent hover:border-white/70 transition-colors"
          style={{ width: '160px', height: '100px' }}
        >
          <div className="flex items-center gap-2 rounded-full bg-slate-950/85 px-3.5 py-2 text-white shadow-lg backdrop-blur-md group-hover:bg-slate-900 transition-colors">
            <UserPlus size={16} strokeWidth={2.2} />
            <span className="text-[12px] font-semibold uppercase tracking-wider">
              Invite
            </span>
          </div>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="center"
          sideOffset={10}
          className="z-50 w-80 rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-2xl p-4"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Invite to room</h3>
              <p className="mt-0.5 text-xs text-white/55">
                Send the link to anyone you want in the call.
              </p>
            </div>
            <Popover.Close
              className="text-white/45 hover:text-white transition-colors shrink-0"
              aria-label="Close"
            >
              <X size={15} />
            </Popover.Close>
          </div>

          {/* Quick share targets — one row */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <ShareTile
              label={copied ? 'Copied' : 'Copy'}
              icon={copied ? Check : Copy}
              onClick={copyUrl}
              active={copied}
            />
            <ShareTile
              label="Email"
              icon={Mail}
              href={emailHref}
            />
            <ShareTile
              label="WhatsApp"
              icon={FaWhatsapp}
              href={whatsappHref}
              accentColor="#25D366"
            />
            <ShareTile
              label="Slack"
              icon={FaSlack}
              onClick={copySlackMessage}
            />
          </div>

          {/* Raw URL — readable + selectable */}
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 flex items-center gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 bg-transparent text-xs text-white/75 outline-none truncate"
            />
            <button
              type="button"
              onClick={copyUrl}
              className="shrink-0 text-white/55 hover:text-white transition-colors"
              aria-label="Copy URL"
              title="Copy URL"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ────────────────────────────────────────────────────────── share tile

type ShareTileProps = {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  accentColor?: string;
};

function ShareTile({ label, icon: Icon, href, onClick, active, accentColor }: ShareTileProps) {
  const className = [
    'group flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/25 transition-all p-3',
    active ? 'border-emerald-400/40 bg-emerald-500/10' : '',
  ].join(' ');

  const content = (
    <>
      <Icon
        size={20}
        className="transition-colors"
        // Brand-color hint on hover for platforms (WhatsApp green etc.)
        // Kept subtle — no full chip background, just a tint on the icon.
        {...(accentColor ? { style: { color: accentColor } } : {})}
      />
      <span className="text-[11px] font-semibold text-white/75 group-hover:text-white transition-colors">
        {label}
      </span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
