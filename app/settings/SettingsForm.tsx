'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Loader2 } from 'lucide-react';
import {
  IDLE_MINUTES_OPTIONS,
  type UserPreferences,
} from '@/lib/user-preferences';

const PRIMARY = '#4f8cff';

type Props = {
  initialName: string;
  email: string;
  initialPreferences: UserPreferences;
};

export function SettingsForm({ initialName, email, initialPreferences }: Props) {
  const [name, setName] = useState(initialName);
  const [prefs, setPrefs] = useState<UserPreferences>(initialPreferences);
  const [saving, setSaving] = useState(false);

  // We compare current → initial to enable the Save button only when there's
  // something to save. Cheap deep-ish equality good enough for this shape.
  const dirty =
    name !== initialName ||
    JSON.stringify(prefs) !== JSON.stringify(initialPreferences);

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, preferences: prefs }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      toast.success('Settings saved');
      // Reload so the SSR-rendered values stay in sync if the user navigates
      // back without a full reload.
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-10">
      {/* ----- Profile ------------------------------------------------- */}
      <Section
        title="Profile"
        description="How you appear in rooms you join."
      >
        <Field label="Display name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            minLength={2}
            maxLength={80}
            className={inputClass}
          />
        </Field>
        <Field label="Email" hint="Used to sign in. Contact support to change.">
          <input
            type="email"
            value={email}
            readOnly
            className={`${inputClass} cursor-not-allowed bg-white/5 text-white/55`}
          />
        </Field>
      </Section>

      {/* ----- Room defaults ------------------------------------------ */}
      <Section
        title="Room defaults"
        description="Applied automatically when you create a new room."
      >
        <Field
          label="Default Vibe mode"
          hint="When new rooms start, should the AI capture conversations right away?"
        >
          <RadioGroup
            value={prefs.defaultCaptureState}
            options={[
              {
                value: 'listening',
                label: 'Listening',
                desc: 'AI captures from the moment the room opens',
              },
              {
                value: 'paused',
                label: 'Off the record',
                desc: 'Room starts private; you click Vibe on to start capturing',
              },
            ]}
            onChange={(v) =>
              setPrefs((p) => ({ ...p, defaultCaptureState: v as 'listening' | 'paused' }))
            }
          />
        </Field>

        <Field
          label="Auto-pause when idle"
          hint="If no one's speaking, pause capture after this long."
        >
          <select
            value={prefs.idleAutoPauseMinutes}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, idleAutoPauseMinutes: Number(e.target.value) }))
            }
            className={inputClass}
          >
            {IDLE_MINUTES_OPTIONS.map((mins) => (
              <option key={mins} value={mins}>
                {mins === 0 ? 'Never' : `${mins} minutes`}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Detections per decision"
          hint="How many intents the room pools before auto-proposing a decision. Higher = fewer, more deliberate decisions. Lower = faster, more reactive."
        >
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={3}
              max={20}
              value={prefs.autoComposeThreshold}
              onChange={(e) =>
                setPrefs((p) => ({
                  ...p,
                  autoComposeThreshold: Number(e.target.value),
                }))
              }
              className="flex-1 accent-blue-500"
            />
            <div className="w-12 text-center text-base font-semibold text-white tabular-nums">
              {prefs.autoComposeThreshold}
            </div>
          </div>
        </Field>
      </Section>

      {/* ----- Save bar ------------------------------------------------ */}
      <div className="sticky bottom-6 z-20">
        <div className="rounded-2xl border border-white/10 bg-slate-900/85 backdrop-blur-2xl px-5 py-3 flex items-center justify-between shadow-xl">
          <div className="text-sm text-white/65">
            {dirty ? 'Unsaved changes' : 'All changes saved'}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: PRIMARY }}
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Check size={14} strokeWidth={2.6} />
                Save changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- helpers

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-xl p-7">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-white/55">{description}</p>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-white">{label}</div>
      {hint && <div className="mt-1 text-xs text-white/50 leading-relaxed">{hint}</div>}
      <div className="mt-3">{children}</div>
    </label>
  );
}

function RadioGroup({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string; desc: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              'text-left rounded-xl border px-4 py-3 transition-all',
              active
                ? 'border-blue-400/60 bg-blue-500/10 ring-1 ring-blue-400/30'
                : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]',
            ].join(' ')}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <span
                className={[
                  'h-2 w-2 rounded-full',
                  active ? 'bg-blue-400' : 'bg-white/25',
                ].join(' ')}
              />
              {opt.label}
            </div>
            <div className="mt-1 text-xs text-white/55 leading-relaxed">{opt.desc}</div>
          </button>
        );
      })}
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-white/12 bg-slate-950/40 px-3 py-2.5 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400/50 transition-colors';
