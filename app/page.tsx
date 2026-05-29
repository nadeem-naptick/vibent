/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import {
  ArrowRight,
  Sparkles,
  Video,
  ScreenShare,
  Mic,
  Upload,
  Palette,
  Database,
  Share2,
  Download,
  GitBranch,
  CheckCircle2,
  ChevronRight,
  Layers,
  Brain,
  Wand2,
  MessagesSquare,
  Quote,
  PlayCircle,
} from 'lucide-react';
import { auth } from '@/auth';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { listTemplates } from '@/lib/templates';

// Reference: Coderthemes Block "Landing SaaS v1" — light theme, white
// background, violet #8B3DFF primary, slate text scale, Public Sans.

const PRIMARY = '#8B3DFF';
const PRIMARY_HOVER = '#7B2EE8';
const PRIMARY_SUBTLE = '#F3EBFF';

const IMG = {
  pmDesigner:
    'https://images.unsplash.com/photo-1552581234-26160f608093?w=1200&h=900&fit=crop&q=80',
  founders:
    'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200&h=900&fit=crop&q=80',
  marketing:
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=900&fit=crop&q=80',
  faces: [
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=128&h=128&fit=crop&q=80',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=128&h=128&fit=crop&q=80',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128&h=128&fit=crop&q=80',
    'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=128&h=128&fit=crop&q=80',
  ],
};

export default async function HomePage() {
  const session = await auth();
  const signedIn = !!session?.user;
  const templates = listTemplates();
  const initial = (session?.user?.name ?? '?')[0]?.toUpperCase() ?? '?';
  const startHref = signedIn ? '/rooms/new' : '/signin';

  return (
    <main
      className="bg-white text-slate-700 antialiased"
      style={{ fontFamily: 'var(--font-public-sans), ui-sans-serif, system-ui, sans-serif' }}
    >
      {/* =========================================================
          NAV
      ========================================================= */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-[72px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg" style={{ backgroundColor: PRIMARY }}>
              <Sparkles size={16} className="text-white" strokeWidth={2.4} />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">vibemtg</span>
          </Link>
          <nav className="hidden md:flex items-center gap-9 text-[15px] font-medium text-slate-700">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#scenarios" className="hover:text-slate-900 transition-colors">Scenarios</a>
            <a href="#templates" className="hover:text-slate-900 transition-colors">Templates</a>
            <a href="#testimonials" className="hover:text-slate-900 transition-colors">Customers</a>
          </nav>
          {signedIn ? (
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 text-[15px] font-semibold text-slate-700 hover:text-slate-900 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/rooms/new"
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[15px] font-semibold text-white transition-colors shadow-sm hover:shadow"
                style={{ backgroundColor: PRIMARY }}
              >
                New room
                <ArrowRight size={15} strokeWidth={2.4} />
              </Link>
              <div className="hidden sm:grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                {initial}
              </div>
              <SignOutButton />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/signin" className="hidden sm:inline-flex text-[15px] font-medium text-slate-700 hover:text-slate-900 transition-colors">
                Sign in
              </Link>
              <Link
                href="/signin"
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[15px] font-semibold text-white transition-colors shadow-sm hover:shadow"
                style={{ backgroundColor: PRIMARY }}
              >
                Try for free
                <ArrowRight size={15} strokeWidth={2.4} />
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* =========================================================
          HERO — centered, dual CTAs, trust signal, big screenshot
      ========================================================= */}
      <section className="relative overflow-hidden pt-20 lg:pt-28 pb-12 lg:pb-16">
        {/* Subtle background tint */}
        <div className="absolute inset-x-0 top-0 h-[600px] bg-gradient-to-b from-[#F8F4FF] via-white to-white pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{ backgroundColor: PRIMARY_SUBTLE, color: PRIMARY }}
          >
            <span className="inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PRIMARY }} />
            Now in private beta
          </div>
          <h1 className="mt-7 text-[44px] sm:text-[60px] lg:text-[80px] font-extrabold tracking-[-0.025em] leading-[1.05] text-slate-900 max-w-5xl mx-auto">
            Your next meeting builds the product.
          </h1>
          <p className="mt-7 max-w-2xl mx-auto text-lg lg:text-xl text-slate-500 leading-relaxed">
            vibemtg is a video room where your team talks through what they want
            — a landing page, a clickable prototype, a deck, a dashboard — and
            it takes shape live, while you discuss it.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={startHref}
              className="inline-flex items-center gap-2.5 rounded-lg px-7 py-4 text-[15px] font-semibold text-white shadow-md hover:shadow-lg transition-all"
              style={{ backgroundColor: PRIMARY }}
            >
              Try for free
              <ArrowRight size={16} strokeWidth={2.4} />
            </Link>
            <a
              href="#scenarios"
              className="inline-flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-7 py-4 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <PlayCircle size={16} strokeWidth={2} />
              See it work
            </a>
          </div>
          <div className="mt-5 text-sm text-slate-400">
            No credit card required · First artifact in ~90 seconds
          </div>
        </div>

        {/* Hero screenshot — real product image */}
        <div className="relative mt-16 lg:mt-20 max-w-6xl mx-auto px-6 lg:px-8">
          <div className="relative">
            {/* Soft violet glow underneath */}
            <div className="absolute -inset-x-10 -bottom-10 h-32 bg-gradient-to-t from-purple-300/40 to-transparent blur-3xl rounded-full pointer-events-none" />
            <div className="relative rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
              <img
                src="/vibentimg.png"
                alt="vibemtg — a video room where a real product takes shape live"
                className="w-full h-auto block"
              />
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          CLIENT / STACK LOGO STRIP
      ========================================================= */}
      <section className="py-12 lg:py-16 border-y border-slate-100 bg-slate-50/60">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center text-xs uppercase tracking-[0.22em] text-slate-400 font-bold">
            Built on the infrastructure powering modern products
          </div>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-10 gap-y-6 items-center justify-items-center">
            {['LiveKit', 'Deepgram', 'Anthropic', 'Gemini', 'Vercel AI', 'E2B'].map((name) => (
              <div key={name} className="text-lg font-bold tracking-tight text-slate-400 hover:text-slate-600 transition-colors">
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================
          FEATURES — 6-card grid (matches reference exactly)
      ========================================================= */}
      <section id="features" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: PRIMARY }}>
              Capabilities
            </div>
            <h2 className="mt-4 text-4xl lg:text-5xl font-extrabold tracking-[-0.02em] text-slate-900 leading-[1.1]">
              Everything you need to ship from a meeting
            </h2>
            <p className="mt-5 text-lg text-slate-500 leading-relaxed">
              The room handles the listening, the deciding, and the building —
              all in one surface.
            </p>
          </div>
          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard icon={Mic} title="Real-time transcription" body="Deepgram nova streams every utterance into a live transcript with speaker labels." />
            <FeatureCard icon={Sparkles} title="Intent classification" body="An intelligence layer sorts what's said into ideas, decisions, constraints, and noise." />
            <FeatureCard icon={CheckCircle2} title="Host approval" body="Decisions surface as cards the host can edit, approve, or ignore — nothing builds without consent." />
            <FeatureCard icon={Layers} title="Live preview iframe" body="The artifact renders in a sandbox iframe everyone sees, updating section by section." />
            <FeatureCard icon={GitBranch} title="Versioned and reversible" body="Every successful step is snapshotted. Roll back to any version. Continue across sessions." />
            <FeatureCard icon={Share2} title="One-click share" body="Build and upload a public snapshot to a CDN. Send the link to anyone — no sign-in needed." />
          </div>
        </div>
      </section>

      {/* =========================================================
          VISUALIZE & PLAN — alternating row 1 (image left)
      ========================================================= */}
      <section className="py-20 lg:py-28 bg-slate-50/60">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="relative order-2 lg:order-1">
              <img
                src={IMG.pmDesigner}
                alt="A PM and designer collaborating"
                className="rounded-3xl shadow-2xl w-full h-[460px] object-cover"
              />
              {/* Team avatars overlay */}
              <div className="absolute -bottom-6 -right-6 lg:bottom-6 lg:right-6 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {IMG.faces.slice(0, 3).map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      className="h-9 w-9 rounded-full border-2 border-white object-cover"
                    />
                  ))}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">3 in the room</div>
                  <div className="text-[11px] text-slate-500">live · building</div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: PRIMARY }}>
                Visualize and plan
              </div>
              <h2 className="mt-4 text-4xl lg:text-5xl font-extrabold tracking-[-0.02em] text-slate-900 leading-[1.1]">
                Talk it through. The room watches.
              </h2>
              <p className="mt-5 text-lg text-slate-500 leading-relaxed">
                Get on a call with your team. Discuss what you want. The room
                listens to every word, picks up on the decisions, and shows them
                back for approval. You stay in conversation — vibemtg does the
                bookkeeping.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  ['Speaker-labeled live transcripts', 'No more &ldquo;wait, who said that?&rdquo;'],
                  ['Intent categorization in real time', 'Ideas, decisions, constraints — sorted as you talk.'],
                  ['Auto-composed decisions', 'When enough related intents agree, the room proposes a decision.'],
                  ['Host approval before anything ships', 'You always control what gets built.'],
                ].map(([head, sub], i) => (
                  <BenefitRow key={i} head={head} sub={sub} />
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          COLLABORATE — alternating row 2 (image right)
      ========================================================= */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <div className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: PRIMARY }}>
                Build together
              </div>
              <h2 className="mt-4 text-4xl lg:text-5xl font-extrabold tracking-[-0.02em] text-slate-900 leading-[1.1]">
                The agent does the work in the open.
              </h2>
              <p className="mt-5 text-lg text-slate-500 leading-relaxed">
                A real tool-using agent. Web search, scraping, file editing,
                package installs, self-verification. Everyone in the room
                watches the artifact materialize — narrated step by step.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  ['Skeleton first, refinement second', 'See the layout in ~15s. Polish lands over the next minute.'],
                  ['Grounded in real content', 'The agent searches and scrapes any URL you reference.'],
                  ['Self-verifies before declaring done', 'No silent white screens. Auto-fixes broken imports.'],
                  ['Cancelable mid-flight', 'Don’t like the direction? Stop, roll back, talk it out.'],
                ].map(([head, sub], i) => (
                  <BenefitRow key={i} head={head} sub={sub} />
                ))}
              </ul>
            </div>
            <div className="relative">
              <img
                src={IMG.founders}
                alt="A startup team collaborating"
                className="rounded-3xl shadow-2xl w-full h-[460px] object-cover"
              />
              <div className="absolute -top-6 -left-6 lg:top-6 lg:left-6 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 max-w-[260px]">
                <div className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Live ticker</div>
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-slate-700 flex items-center gap-2">
                    <span>🌐</span> Reading linear.app/pricing
                  </div>
                  <div className="text-xs text-slate-700 flex items-center gap-2">
                    <span>✍️</span> Drafting Hero.jsx
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span>🩺</span> Checking the preview…
                  </div>
                </div>
                <div className="mt-4 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full w-[68%] rounded-full" style={{ backgroundColor: PRIMARY }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          SCENARIOS — 3 use cases (cards in a grid)
      ========================================================= */}
      <section id="scenarios" className="py-24 lg:py-32 bg-slate-50/60">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: PRIMARY }}>
              Who it's for
            </div>
            <h2 className="mt-4 text-4xl lg:text-5xl font-extrabold tracking-[-0.02em] text-slate-900 leading-[1.1]">
              The kinds of meetings that change
            </h2>
            <p className="mt-5 text-lg text-slate-500 leading-relaxed">
              Three teams. Three different artifacts. The same idea — leave
              the meeting with something shippable.
            </p>
          </div>

          <div className="mt-16 grid lg:grid-cols-3 gap-7">
            <ScenarioCard
              image={IMG.pmDesigner}
              tag="Product + design"
              title="Prototype the feature, together."
              body="PM talks requirements. Designer talks UX. The agent builds the working wireframe. Forty minutes later you share the URL with five customers."
              faces={IMG.faces.slice(0, 2)}
            />
            <ScenarioCard
              image={IMG.founders}
              tag="Founders + deck"
              title="Build a pitch deck across 30-min sessions."
              body="Half-hour standing meeting daily. Upload reference templates, point at your brand site for colors. By Friday the deck exists."
              faces={IMG.faces.slice(2, 5)}
            />
            <ScenarioCard
              image={IMG.marketing}
              tag="Marketing + data"
              title="Analyze campaigns and shape strategy live."
              body="Connect your analytics. Ask a question, watch a chart appear. Switch to spreadsheet mode for what-ifs. Captures strategy as a doc."
              faces={IMG.faces.slice(0, 2)}
              comingSoon
            />
          </div>
        </div>
      </section>

      {/* =========================================================
          TEMPLATES — integrations-style grid
      ========================================================= */}
      <section id="templates" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: PRIMARY }}>
              Templates
            </div>
            <h2 className="mt-4 text-4xl lg:text-5xl font-extrabold tracking-[-0.02em] text-slate-900 leading-[1.1]">
              Eight templates today. More on the way.
            </h2>
            <p className="mt-5 text-lg text-slate-500 leading-relaxed">
              Pick one when you create the room. Each template shapes the
              agent&apos;s vocabulary, structure, and defaults.
            </p>
          </div>

          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {templates.map((t) => {
              const Icon = t.icon;
              return (
                <div
                  key={t.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 hover:border-slate-300 hover:shadow-md transition-all"
                >
                  <div
                    className="grid h-11 w-11 place-items-center rounded-xl"
                    style={{ backgroundColor: PRIMARY_SUBTLE, color: PRIMARY }}
                  >
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <div className="mt-6 text-lg font-bold text-slate-900 leading-snug">{t.name}</div>
                  <div className="mt-3 text-[15px] text-slate-500 leading-relaxed">{t.tagline}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-10 flex items-center justify-center flex-wrap gap-2 text-sm text-slate-400">
            <span>Coming soon:</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">PDF reports</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Graphic design</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Mobile native</span>
          </div>
        </div>
      </section>

      {/* =========================================================
          TESTIMONIALS — 3 column carousel-style
      ========================================================= */}
      <section id="testimonials" className="py-24 lg:py-32 bg-slate-50/60">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: PRIMARY }}>
              From early teams
            </div>
            <h2 className="mt-4 text-4xl lg:text-5xl font-extrabold tracking-[-0.02em] text-slate-900 leading-[1.1]">
              What it actually feels like
            </h2>
          </div>
          <div className="mt-14 grid lg:grid-cols-3 gap-6">
            <Testimonial
              quote="We used to leave product-design syncs with a stack of action items. Now we leave with a clickable prototype. The first time it happened my designer just stared at the screen."
              author="Priya R."
              role="Head of Product"
              org="Series-B fintech · private beta"
              avatar={IMG.faces[0]}
            />
            <Testimonial
              quote="I have a recurring 30-minute deck-review with my co-founder. By Friday we had something we actually showed to an investor. We never opened PowerPoint."
              author="Jordan A."
              role="Founder"
              org="Climate-tech startup · private beta"
              avatar={IMG.faces[1]}
            />
            <Testimonial
              quote="The thing that surprised me: my marketing analyst was asking the room questions about ad performance and getting charts back. Then she'd pivot to a strategy doc in the same window."
              author="Marcus T."
              role="VP Marketing"
              org="DTC brand · private beta"
              avatar={IMG.faces[2]}
            />
          </div>
        </div>
      </section>

      {/* =========================================================
          CTA SIGNUP
      ========================================================= */}
      <section className="py-24 lg:py-32">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div
            className="relative overflow-hidden rounded-[32px] p-12 lg:p-20 text-center"
            style={{ backgroundColor: PRIMARY }}
          >
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_50%),radial-gradient(circle_at_70%_70%,rgba(255,255,255,0.15),transparent_50%)]" />
            <div className="relative">
              <h2 className="text-4xl lg:text-6xl font-extrabold tracking-[-0.025em] leading-[1.05] text-white max-w-3xl mx-auto">
                Your next meeting should ship something.
              </h2>
              <p className="mt-6 max-w-xl mx-auto text-lg text-white/85 leading-relaxed">
                Get on a call with your team. Talk for a few minutes. Watch the
                artifact appear. Send the link before you hang up.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href={startHref}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-7 py-4 text-[15px] font-bold text-slate-900 shadow-lg hover:shadow-xl transition-all"
                >
                  Try for free
                  <ArrowRight size={16} strokeWidth={2.4} />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 backdrop-blur-sm px-7 py-4 text-[15px] font-semibold text-white hover:bg-white/15 transition-colors"
                >
                  Book a demo
                </a>
              </div>
              <div className="mt-5 text-sm text-white/70">
                No credit card · Free until you upgrade
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          FOOTER — multi-column
      ========================================================= */}
      <footer className="bg-slate-900 text-slate-300 pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-10 mb-16">
            <div className="lg:col-span-4">
              <Link href="/" className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg" style={{ backgroundColor: PRIMARY }}>
                  <Sparkles size={16} className="text-white" strokeWidth={2.4} />
                </div>
                <span className="text-lg font-bold tracking-tight text-white">vibemtg</span>
              </Link>
              <p className="mt-5 max-w-xs text-sm text-slate-400 leading-relaxed">
                A video room where your team gets on a call, talks, and a real
                product takes shape live.
              </p>
              <div className="mt-6 flex items-center gap-3 text-slate-400">
                <a href="#" className="hover:text-white transition-colors">Twitter</a>
                <span className="text-slate-700">·</span>
                <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
                <span className="text-slate-700">·</span>
                <a href="#" className="hover:text-white transition-colors">GitHub</a>
              </div>
            </div>

            <FooterColumn
              title="Product"
              items={[
                { label: 'Features', href: '#features' },
                { label: 'Scenarios', href: '#scenarios' },
                { label: 'Templates', href: '#templates' },
                { label: 'Customers', href: '#testimonials' },
              ]}
            />
            <FooterColumn
              title="Templates"
              items={templates.slice(0, 5).map((t) => ({ label: t.name, href: startHref }))}
            />
            <FooterColumn
              title="Resources"
              items={[
                { label: 'Sign in', href: '/signin' },
                { label: 'Start a room', href: startHref },
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'Changelog', href: '#' },
              ]}
            />
            <FooterColumn
              title="Company"
              items={[
                { label: 'About', href: '#' },
                { label: 'Privacy', href: '#' },
                { label: 'Terms', href: '#' },
                { label: 'Contact', href: '#' },
              ]}
            />
          </div>

          <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>© {new Date().getFullYear()} vibemtg. All rights reserved.</div>
            <div>Built in private beta · meet · think · generate</div>
          </div>
        </div>
      </footer>
    </main>
  );
}

// ============================================================================
// COMPONENTS
// ============================================================================

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Sparkles;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 hover:border-slate-300 hover:shadow-md transition-all">
      <div
        className="grid h-12 w-12 place-items-center rounded-xl"
        style={{ backgroundColor: PRIMARY_SUBTLE, color: PRIMARY }}
      >
        <Icon size={22} strokeWidth={2} />
      </div>
      <h3 className="mt-6 text-xl font-bold text-slate-900 leading-snug">{title}</h3>
      <p className="mt-3 text-[15px] text-slate-500 leading-relaxed">{body}</p>
    </div>
  );
}

function BenefitRow({ head, sub }: { head: string; sub: string }) {
  return (
    <li className="flex gap-4">
      <div className="mt-0.5 shrink-0">
        <div
          className="grid h-7 w-7 place-items-center rounded-full"
          style={{ backgroundColor: PRIMARY_SUBTLE, color: PRIMARY }}
        >
          <CheckCircle2 size={15} strokeWidth={2.4} />
        </div>
      </div>
      <div>
        <div className="text-[15px] font-bold text-slate-900 leading-snug">{head}</div>
        <div className="mt-1.5 text-[14px] text-slate-500 leading-relaxed" dangerouslySetInnerHTML={{ __html: sub }} />
      </div>
    </li>
  );
}

function ScenarioCard({
  image,
  tag,
  title,
  body,
  faces,
  comingSoon,
}: {
  image: string;
  tag: string;
  title: string;
  body: string;
  faces: string[];
  comingSoon?: boolean;
}) {
  return (
    <div className="group rounded-3xl border border-slate-200 bg-white overflow-hidden hover:shadow-xl transition-all">
      <div className="relative h-56 overflow-hidden">
        <img src={image} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute top-4 left-4">
          <span
            className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: 'white', color: PRIMARY }}
          >
            {tag}
          </span>
        </div>
        {comingSoon && (
          <div className="absolute top-4 right-4 rounded-full bg-amber-400 text-amber-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
            Coming soon
          </div>
        )}
      </div>
      <div className="p-8">
        <h3 className="text-xl font-bold text-slate-900 leading-snug">{title}</h3>
        <p className="mt-4 text-[15px] text-slate-500 leading-relaxed">{body}</p>
        <div className="mt-7 flex items-center gap-3">
          <div className="flex -space-x-2">
            {faces.map((src, i) => (
              <img key={i} src={src} alt="" className="h-8 w-8 rounded-full border-2 border-white object-cover" />
            ))}
          </div>
          <div className="text-xs text-slate-500 font-semibold">{faces.length} in the room</div>
        </div>
      </div>
    </div>
  );
}

function Testimonial({
  quote,
  author,
  role,
  org,
  avatar,
}: {
  quote: string;
  author: string;
  role: string;
  org: string;
  avatar: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-7 lg:p-8 flex flex-col h-full hover:shadow-md transition-shadow">
      <Quote size={28} style={{ color: PRIMARY }} strokeWidth={1.6} />
      <p className="mt-4 text-[15px] lg:text-base text-slate-700 leading-relaxed flex-1">
        &ldquo;{quote}&rdquo;
      </p>
      <div className="mt-6 pt-6 border-t border-slate-100 flex items-center gap-3">
        <img src={avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
        <div>
          <div className="text-sm font-bold text-slate-900">{author}</div>
          <div className="text-xs text-slate-500">{role} · {org}</div>
        </div>
      </div>
    </div>
  );
}

function FooterColumn({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string }[];
}) {
  return (
    <div className="lg:col-span-2">
      <div className="text-xs uppercase tracking-[0.18em] text-white font-bold">{title}</div>
      <ul className="mt-5 space-y-3">
        {items.map((it) => (
          <li key={it.label}>
            <Link href={it.href} className="text-sm text-slate-400 hover:text-white transition-colors">
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// HERO SCREENSHOT — stylized product window matching the reference's
// "app screenshot with role badges" pattern.
// ============================================================================

function HeroScreenshot() {
  return (
    <div className="relative">
      {/* Soft drop shadow / glow */}
      <div className="absolute -inset-x-10 -bottom-10 h-32 bg-gradient-to-t from-purple-200/40 to-transparent blur-3xl rounded-full" />

      <div className="relative rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-amber-300" />
            <div className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <div className="text-xs font-mono text-slate-400">acme-pricing-deck · slide-deck</div>
          <div className="text-xs text-emerald-600 font-semibold inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            3 in the room
          </div>
        </div>

        {/* Canvas */}
        <div className="relative h-[400px] sm:h-[480px] bg-gradient-to-br from-slate-50 to-white overflow-hidden">
          {/* Top chips */}
          <div className="absolute left-1/2 top-5 -translate-x-1/2 flex items-center gap-2">
            <Chip>Transcript · 28</Chip>
            <ChipPrimary>Tasks · 1</ChipPrimary>
            <Chip>Versions · 7</Chip>
          </div>

          {/* Center activity card */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-500">
                  Drafting slide 6
                </div>
                <div className="text-sm tabular-nums font-bold text-slate-900">72%</div>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-4">
                <div className="h-full w-[72%] rounded-full" style={{ backgroundColor: PRIMARY }} />
              </div>
              <div className="text-sm text-slate-700 flex items-center gap-2">
                <span>🎨</span>
                <span>Applying brand colors from</span>
                <span className="font-mono font-semibold" style={{ color: PRIMARY }}>acme.com</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-1.5">
                {[
                  ['Cover', true],
                  ['Problem', true],
                  ['Solution', true],
                  ['Market', true],
                  ['Pricing', true],
                  ['Team', false],
                ].map(([f, done], i) => (
                  <div
                    key={i}
                    className={`h-8 rounded-md text-[10px] font-bold flex items-center justify-center gap-1.5 ${
                      done
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-50 text-slate-400 border border-slate-200'
                    }`}
                  >
                    {done && <CheckCircle2 size={10} />}
                    {f as string}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom dock + role badges (like reference) */}
          <div className="absolute left-1/2 bottom-5 -translate-x-1/2 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full border border-slate-200 bg-white shadow grid place-items-center text-slate-600">
                <Mic size={14} />
              </div>
              <div className="h-9 w-9 rounded-full border border-slate-200 bg-white shadow grid place-items-center text-slate-600">
                <Video size={14} />
              </div>
              <div className="h-9 w-9 rounded-full border border-slate-200 bg-white shadow grid place-items-center text-slate-600">
                <ScreenShare size={14} />
              </div>
              <div className="h-9 w-9 rounded-full bg-red-500 shadow" />
            </div>
          </div>

          {/* Role pin labels (matching reference's "Developer/Manager/Designer/User") */}
          <div className="hidden md:block">
            <RolePin top="14%" left="6%" label="Host" name="Maya" />
            <RolePin top="55%" left="3%" label="Designer" name="Jordan" />
            <RolePin top="22%" right="6%" label="PM" name="Sam" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-full bg-white border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
      {children}
    </div>
  );
}

function ChipPrimary({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-full px-3 py-1 text-[11px] font-bold text-white shadow-sm"
      style={{ backgroundColor: PRIMARY }}
    >
      {children}
    </div>
  );
}

function RolePin({
  top,
  left,
  right,
  label,
  name,
}: {
  top: string;
  left?: string;
  right?: string;
  label: string;
  name: string;
}) {
  return (
    <div className="absolute" style={{ top, left, right }}>
      <div className="rounded-full bg-white shadow-md border border-slate-200 pl-1 pr-3 py-1 flex items-center gap-2">
        <div
          className="h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold text-white"
          style={{ backgroundColor: PRIMARY }}
        >
          {name[0]}
        </div>
        <div className="text-xs">
          <div className="font-bold text-slate-900 leading-tight">{name}</div>
          <div className="text-[10px] text-slate-500 leading-tight">{label}</div>
        </div>
      </div>
    </div>
  );
}
