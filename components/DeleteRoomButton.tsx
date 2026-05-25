'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  roomId: string;
  roomTitle: string;
};

export function DeleteRoomButton({ roomId, roomTitle }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${roomTitle}"? This removes the room, its transcripts, and its sandbox.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/rooms/${roomId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Delete failed');
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        title="Delete room"
        className="text-neutral-600 hover:text-red-400 disabled:opacity-50 transition-colors text-sm px-2 py-1"
      >
        {pending ? '…' : 'Delete'}
      </button>
      {error && <span className="text-xs text-red-400 ml-2">{error}</span>}
    </>
  );
}
