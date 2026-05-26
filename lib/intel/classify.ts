import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { groq } from '@ai-sdk/groq';
import { z } from 'zod';
import type { Template } from '@/lib/templates';

// ---------------------------------------------------------------------------
// Modular provider selection — swap models via env without changing callers.
// ---------------------------------------------------------------------------

export type IntelProvider = 'anthropic' | 'openai' | 'google' | 'groq';

const DEFAULT_PROVIDER: IntelProvider =
  (process.env.INTEL_PROVIDER as IntelProvider) || 'anthropic';

const DEFAULT_MODELS: Record<IntelProvider, string> = {
  anthropic: process.env.INTEL_MODEL_ANTHROPIC || 'claude-haiku-4-5',
  openai: process.env.INTEL_MODEL_OPENAI || 'gpt-5-mini',
  google: process.env.INTEL_MODEL_GOOGLE || 'gemini-3.5-flash',
  groq: process.env.INTEL_MODEL_GROQ || 'moonshotai/kimi-k2-instruct-0905',
};

function resolveModel(provider: IntelProvider = DEFAULT_PROVIDER) {
  const modelId = DEFAULT_MODELS[provider];
  switch (provider) {
    case 'anthropic':
      return anthropic(modelId);
    case 'openai':
      return openai(modelId);
    case 'google':
      return google(modelId);
    case 'groq':
      return groq(modelId);
  }
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const IntentSchema = z.object({
  type: z.enum([
    'idea',
    'question',
    'decision',
    'instruction',
    'correction',
    'rejected_idea',
    'open_question',
    'constraint',
    'action_item',
    'reference',
    'approved_execution_task',
    'noise',
  ]),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(2).max(220),
  shouldExecute: z.boolean(),
});

export type ClassifiedIntent = z.infer<typeof IntentSchema>;

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

type ClassifyInput = {
  text: string;
  speakerName: string;
  roomObjective?: string | null;
  template?: Template | null;
  recentContext?: string;
  provider?: IntelProvider;
};

export async function classifyUtterance({
  text,
  speakerName,
  roomObjective,
  template,
  recentContext,
  provider,
}: ClassifyInput): Promise<ClassifiedIntent> {
  const { object } = await generateObject({
    model: resolveModel(provider),
    schema: IntentSchema,
    temperature: 0.2,
    prompt: buildPrompt({ text, speakerName, roomObjective, template, recentContext }),
  });
  return object;
}

// ---------------------------------------------------------------------------
// Decision composer — merges N detections into one coherent instruction
// ---------------------------------------------------------------------------

type ComposeInput = {
  roomObjective?: string | null;
  template?: Template | null;
  detections: Array<{ type: string; summary: string; rawText: string; speakerName: string }>;
  provider?: IntelProvider;
};

export async function composeDecision({
  roomObjective,
  template,
  detections,
  provider,
}: ComposeInput): Promise<string> {
  const artifactPhrase = template
    ? `a ${template.artifactKind}`
    : roomObjective
      ? `a ${roomObjective}`
      : 'a digital artifact';

  const decisionHintBlock = template
    ? `\n\nVocabulary for this kind of artifact: ${template.decisionHint}\n`
    : '';

  const { object } = await generateObject({
    model: resolveModel(provider),
    schema: z.object({ instruction: z.string().min(2).max(1500) }),
    temperature: 0.3,
    prompt: `You're helping a product team turn raw discussion fragments into ONE clear, actionable instruction for a code-editing agent.

The team is shaping ${artifactPhrase}. The host has hand-picked the following detections from their discussion as the ones that matter:

${detections
  .map((d, i) => `${i + 1}. [${d.type}] ${d.speakerName}: "${d.rawText}" (gist: ${d.summary})`)
  .join('\n')}
${decisionHintBlock}
Compose a single, concrete instruction (2-5 sentences) that an executing agent could act on directly. Treat constraints and ideas as guardrails. Treat instructions and decisions as the primary intent. Drop anything that's a question or off-topic. Speak in second-person imperative ("Add…", "Change…", "Remove…"). Do NOT include explanations or justifications — just the instruction itself.`,
  });
  return object.instruction;
}

function buildPrompt({
  text,
  speakerName,
  roomObjective,
  template,
  recentContext,
}: {
  text: string;
  speakerName: string;
  roomObjective?: string | null;
  template?: Template | null;
  recentContext?: string;
}) {
  const artifactPhrase = template?.artifactKind ?? roomObjective ?? 'a digital product';
  const templateHintBlock = template
    ? `\n\n# Artifact-specific vocabulary\n${template.classifierHint}\n`
    : '';

  return `You are watching a live product/design meeting where a team is iteratively shaping a digital artifact (${artifactPhrase}). Your job is to classify each new utterance the speaker makes so the room's AI panel can show relevant signals to the host.${templateHintBlock}

# Categories
- idea — a suggestion, may or may not be acted on
- question — the speaker is asking, not telling
- decision — a clear conclusion the team has reached
- instruction — a directive to change the artifact
- correction — a fix to something previously discussed
- rejected_idea — speaker is explicitly dismissing a prior idea
- open_question — something the team can't yet answer
- constraint — a guardrail on the artifact (e.g. "must be premium", "keep hero unchanged")
- action_item — a follow-up task outside the artifact (e.g. "Sarah will check with legal")
- reference — naming or pointing at an external artifact / inspiration
- approved_execution_task — a clear, host-approved instruction to modify the artifact NOW
- noise — small talk, filler, off-topic; should not appear in the panel

# Execution rule
Set shouldExecute = true ONLY when:
- The category is approved_execution_task OR
- The category is instruction AND the speaker is clearly directing immediate action ("apply this", "make this change", "let's add X now")

Set shouldExecute = false when:
- It's an idea, question, brainstorm, or hedged language ("maybe", "what if", "should we", "not sure", "thinking about")
- It's a constraint or reference (those inform future tasks but don't trigger execution)
- There's any ambiguity about whether the team agreed

# Recent context
${recentContext?.trim() || '(start of conversation)'}

# New utterance
${speakerName}: "${text}"

Classify it. Make the summary short and action-oriented (≤ 150 chars). If it's noise, summary can just paraphrase what was said.`;
}
