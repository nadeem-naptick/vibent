'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const [outputType, setOutputType] = useState<RoomOutputType>(
    'react_landing_page',
  );
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id);
  const [companyName, setCompanyName] = useState('');
  const [audience, setAudience] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [tone, setTone] = useState('');
  const [referenceLinks, setReferenceLinks] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

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
    <form onSubmit={onSubmit} className="space-y-6">
      <Field label="Room title">
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Naptick landing page review"
          className={inputClass}
        />
      </Field>

      <Field label="Objective">
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
          className={inputClass}
        >
          {(Object.keys(OBJECTIVE_LABELS) as RoomObjective[]).map((k) => (
            <option key={k} value={k}>
              {OBJECTIVE_LABELS[k]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Output type">
        <select
          value={outputType}
          onChange={(e) => setOutputType(e.target.value as RoomOutputType)}
          className={inputClass}
        >
          {(Object.keys(OUTPUT_TYPE_LABELS) as RoomOutputType[]).map((k) => (
            <option key={k} value={k}>
              {OUTPUT_TYPE_LABELS[k]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Template">
        <div className="grid gap-2">
          {(relevantTemplates.length > 0 ? relevantTemplates : TEMPLATES).map(
            (t) => (
              <label
                key={t.id}
                className={`block cursor-pointer rounded-md border px-4 py-3 transition-colors ${
                  templateId === t.id
                    ? 'border-neutral-500 bg-neutral-900'
                    : 'border-neutral-900 hover:border-neutral-800'
                }`}
              >
                <input
                  type="radio"
                  name="template"
                  value={t.id}
                  checked={templateId === t.id}
                  onChange={() => setTemplateId(t.id)}
                  className="sr-only"
                />
                <div className="font-medium text-sm">{t.name}</div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  {t.description}
                </div>
              </label>
            ),
          )}
        </div>
      </Field>

      <div className="pt-2 border-t border-neutral-900">
        <p className="text-xs uppercase tracking-widest text-neutral-500 mb-4">
          Project context (optional)
        </p>
        <div className="space-y-4">
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
      </div>

      {error && (
        <div className="rounded-md border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-neutral-100 text-neutral-950 px-5 py-2 font-medium hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Creating room…' : 'Create room'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="text-sm text-neutral-500 hover:text-neutral-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-neutral-400">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-base placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600';
