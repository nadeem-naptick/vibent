'use client';

type Props = {
  sandboxUrl: string | null;
  status: string;
  iframeKey: string;
};

export function Canvas({ sandboxUrl, status, iframeKey }: Props) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#05070A]">
      {/* Atmospheric background — visible at edges where iframe doesn't reach */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,140,255,.10),transparent_36%),radial-gradient(circle_at_72%_35%,rgba(255,184,107,.06),transparent_30%),#05070A]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:44px_44px] opacity-50" />

      {/* The iframe holds the live sandbox; everything else floats over it */}
      <div className="absolute inset-0 px-4 py-4">
        <div className="relative h-full w-full overflow-hidden rounded-[28px] border border-white/8 bg-white shadow-[0_40px_120px_rgba(0,0,0,.58)]">
          {sandboxUrl ? (
            <iframe
              key={iframeKey}
              src={sandboxUrl}
              className="h-full w-full border-0"
              title="Room artifact preview"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            />
          ) : status === 'error' ? (
            <PreviewMessage tone="error">
              Sandbox provisioning failed. Check server logs.
            </PreviewMessage>
          ) : (
            <PreviewMessage tone="info">
              Provisioning workspace… this takes 10–30 seconds.
            </PreviewMessage>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewMessage({
  tone,
  children,
}: {
  tone: 'info' | 'error';
  children: React.ReactNode;
}) {
  const colors =
    tone === 'error' ? 'bg-red-50 text-red-900' : 'bg-neutral-50 text-neutral-600';
  return (
    <div className={`h-full flex items-center justify-center ${colors}`}>
      <p className="text-sm">{children}</p>
    </div>
  );
}
