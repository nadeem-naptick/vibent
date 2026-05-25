// Same atmospheric backdrop used by the Live Room canvas. Drop on any page
// to get the deep slate + blue/amber glow + grid texture.
export function AtmosphericBackground() {
  return (
    <>
      <div className="fixed inset-0 -z-10 bg-[#05070A]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,rgba(79,140,255,.12),transparent_42%),radial-gradient(circle_at_72%_70%,rgba(255,184,107,.08),transparent_38%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:44px_44px] opacity-50" />
    </>
  );
}
