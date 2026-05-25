'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import {
  TEMPLATES,
  OBJECTIVE_LABELS,
  OUTPUT_TYPE_LABELS,
  type RoomObjective,
  type RoomOutputType,
} from '@/lib/templates';

export function CreateRoomForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState<RoomObjective>('landing_page');
  const [outputType, setOutputType] = useState<RoomOutputType>('react_landing_page');
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id);
  const [companyName, setCompanyName] = useState('');
  const [audience, setAudience] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [tone, setTone] = useState('');
  const [referenceLinks, setReferenceLinks] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [contextOpen, setContextOpen] = useState(false);

  const relevantTemplates = TEMPLATES.filter((t) => t.objective === objective);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      title,
      objective,
      outputType,
      templateId,
      context: {
        companyName: companyName || undefined,
        audience: audience || undefined,
        problemStatement: problemStatement || undefined,
        tone: tone || undefined,
        referenceLinks: referenceLinks
          ? referenceLinks.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
          : undefined,
        additionalNotes: additionalNotes || undefined,
      },
    };

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      {/* Title */}
      <Field label="Room title" required>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Naptick landing page review"
          className={inputClass}
        />
      </Field>

      {/* Objective + output type */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Objective">
          <SelectWrap>
            <select
              value={objective}
              onChange={(e) => {
                const v = e.target.value as RoomObjective;
                setObjective(v);
                const firstTpl = TEMPLATES.find((t) => t.objective === v);
                if (firstTpl) {
                  setTemplateId(firstTpl.id);
                  setOutputType(firstTpl.outputType);
                }
              }}
              className={selectClass}
            >
              {(Object.keys(OBJECTIVE_LABELS) as RoomObjective[]).map((k) => (
                <option key={k} value={k}>
                  {OBJECTIVE_LABELS[k]}
                </option>
              ))}
            </select>
          </SelectWrap>
        </Field>

        <Field label="Output type">
          <SelectWrap>
            <select
              value={outputType}
              onChange={(e) => setOutputType(e.target.value as RoomOutputType)}
              className={selectClass}
            >
              {(Object.keys(OUTPUT_TYPE_LABELS) as RoomOutputType[]).map((k) => (
                <option key={k} value={k}>
                  {OUTPUT_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
          </SelectWrap>
        </Field>
      </div>

      {/* Templates */}
      <Field label="Starting template">
        <div className="grid gap-2 sm:grid-cols-2">
          {(relevantTemplates.length > 0 ? relevantTemplates : TEMPLATES).map((t) => {
            const selected = templateId === t.id;
            return (
              <label
                key={t.id}
                className={`relative block cursor-pointer rounded-2xl border p-4 transition-all ${
                  selected
                    ? 'border-blue-400/40 bg-blue-500/10 shadow-lg shadow-blue-500/10'
                    : 'border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]'
                }`}
              >
                <input
                  type="radio"
                  name="template"
                  value={t.id}
                  checked={selected}
                  onChange={() => setTemplateId(t.id)}
                  className="sr-only"
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{t.name}</div>
                    <div className="text-xs text-white/55 mt-1 leading-relaxed">
                      {t.description}
                    </div>
                  </div>
                  {selected && (
                    <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-500 text-white text-[10px] font-bold">
                      ✓
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </Field>

      {/* Project context — collapsible */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02]">
        <button
          type="button"
          onClick={() => setContextOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <div>
            <div className="text-sm font-semibold text-white">Project context</div>
            <div className="text-xs text-white/45 mt-0.5">
              Optional · helps the agent ground its output in your brand
            </div>
          </div>
          <ChevronDown
            size={18}
            className={`text-white/55 transition-transform ${contextOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {contextOpen && (
          <div className="border-t border-white/8 p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company / product name">
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Audience">
                <input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="e.g. Sleep-deprived professionals"
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Problem you're solving">
              <textarea
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
                rows={2}
                className={inputClass}
              />
            </Field>
            <Field label="Tone">
              <input
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="e.g. Premium, calming, minimal"
                className={inputClass}
              />
            </Field>
            <Field label="Reference links (one per line)">
              <textarea
                value={referenceLinks}
                onChange={(e) => setReferenceLinks(e.target.value)}
                rows={3}
                placeholder="https://eight.sleep&#10;https://oura.com"
                className={inputClass}
              />
            </Field>
            <Field label="Additional notes">
              <textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                rows={3}
                className={inputClass}
              />
            </Field>
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

function SelectWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/45"
      />
    </div>
  );
}

const inputClass =
  'w-full rounded-xl bg-white/[0.03] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400/40 transition-colors';

const selectClass = `${inputClass} appearance-none pr-9`;
