'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronDown, AlertCircle } from 'lucide-react';
import { listTemplates, type Template } from '@/lib/templates';

const TEMPLATES = listTemplates();

export function CreateRoomForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id);
  const [instructions, setInstructions] = useState('');
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          templateId,
          instructions: instructions.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const { id } = await res.json();
      router.push(`/rooms/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-7">
      <Field label="Room title" required>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Naptick landing page review"
          className={inputClass}
        />
      </Field>

      <Field label="What are you building?">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              selected={templateId === t.id}
              onSelect={() => setTemplateId(t.id)}
            />
          ))}
        </div>
      </Field>

      <div className="rounded-2xl border border-white/8 bg-white/[0.02]">
        <button
          type="button"
          onClick={() => setInstructionsOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <div>
            <div className="text-sm font-semibold text-white">Instructions</div>
            <div className="text-xs text-white/45 mt-0.5">
              Optional · anything the agent should know up-front
            </div>
          </div>
          <ChevronDown
            size={18}
            className={`text-white/55 transition-transform ${instructionsOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {instructionsOpen && (
          <div className="border-t border-white/8 p-5">
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={5}
              placeholder="e.g. Brand is calm and minimal. Audience is sleep-deprived professionals. Reference: eight.sleep, oura.com."
              className={inputClass}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3">
          <AlertCircle size={16} className="text-red-300 shrink-0 mt-0.5" />
          <div className="text-sm text-red-200">{error}</div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="text-sm text-white/55 hover:text-white px-4 py-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-blue-500/25 text-blue-50 px-6 py-3 text-sm font-semibold hover:bg-blue-500/35 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Creating room…' : 'Create room'}
          {!submitting && <ArrowRight size={16} strokeWidth={2.4} />}
        </button>
      </div>
    </form>
  );
}

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: Template;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = template.icon;
  return (
    <label
      className={`relative flex flex-col gap-3 cursor-pointer rounded-2xl border p-4 transition-all ${
        selected
          ? 'border-blue-400/40 bg-blue-500/10 shadow-lg shadow-blue-500/10'
          : 'border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]'
      }`}
    >
      <input
        type="radio"
        name="template"
        value={template.id}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <div className="flex items-start justify-between gap-2">
        <div
          className={`grid h-9 w-9 place-items-center rounded-xl ${
            selected ? 'bg-blue-500/30 text-blue-100' : 'bg-white/[0.06] text-white/70'
          }`}
        >
          <Icon size={18} strokeWidth={2} />
        </div>
        {selected && (
          <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-500 text-white text-[10px] font-bold">
            ✓
          </div>
        )}
      </div>
      <div>
        <div className="text-sm font-semibold text-white">{template.name}</div>
        <div className="text-xs text-white/55 mt-1 leading-relaxed">
          {template.tagline}
        </div>
      </div>
    </label>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs uppercase tracking-widest text-white/45">
        {label}
        {required && <span className="text-blue-400 ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-xl bg-white/[0.03] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/40 transition-colors';
