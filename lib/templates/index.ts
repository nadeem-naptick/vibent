// Templates are NOT pre-built scaffolds. A template is intent metadata that
// flows through every AI prompt (classifier, decision composer, executor)
// so they agree on the kind of artifact the room is building.
//
// One generic Vite + React + Tailwind sandbox runs every room. The agent
// decides the actual structure on its first task, guided by executorAddendum.
import {
  Globe,
  Smartphone,
  Presentation,
  Route,
  Workflow,
  BarChart3,
  FileText,
  Table,
  type LucideIcon,
} from 'lucide-react';

export type Template = {
  id: string;
  name: string;
  tagline: string;
  icon: LucideIcon;
  artifactKind: string;

  // Prompt fragments injected into the three AI calls:
  classifierHint: string;
  decisionHint: string;
  executorAddendum: string;

  // Motivational copy shown over the iframe until the first task ships.
  emptyStateTitle: string;
  emptyStateBody: string;
};

const TEMPLATES: Template[] = [
  {
    id: 'landing-page',
    name: 'Landing page',
    tagline: 'Hero, features, CTA — a single page that sells one thing.',
    icon: Globe,
    artifactKind: 'landing page',

    classifierHint:
      'The room is building a marketing landing page — typically one long scrollable page with a hero, features, social proof, pricing, and a CTA. Phrase intents using landing-page vocabulary: "add hero", "rewrite the headline", "add testimonial block", "swap the CTA copy", "tighten the pricing section", "add FAQ".',
    decisionHint:
      'Phrase decisions like marketing-page edits: "Make the hero headline punchier", "Add a three-column features block", "Replace the CTA with a waitlist signup".',
    executorAddendum:
      'You are building a single-page marketing landing page in React + Tailwind. Structure: one top-level page component that composes section components (Hero, Features, SocialProof, Pricing, FAQ, CTA, Footer) — keep each section in its own file so they are independently editable. Default to a clean modern aesthetic; favor large headlines, generous whitespace, and a single primary accent color. No router, no auth, no backend. Anchor links between sections are fine.',
    emptyStateTitle: 'Build something people want to click.',
    emptyStateBody:
      'Start by saying what you’re launching and who it’s for — the hero, features, and CTA will appear as you talk.',
  },
  {
    id: 'mobile-web-app',
    name: 'Mobile web app',
    tagline: 'Phone-frame UI, mobile-first interactions.',
    icon: Smartphone,
    artifactKind: 'mobile web app',

    classifierHint:
      'The room is designing a mobile-web application. Screens are tall, narrow, single-column. Vocabulary: "add a screen", "rework the onboarding flow", "add bottom tab bar", "swap the button to full-width", "add a sheet/modal", "tweak the empty state".',
    decisionHint:
      'Phrase decisions in mobile-flow terms: "Add an account-settings screen", "Move the CTA to a sticky bottom button", "Introduce a 3-step onboarding".',
    executorAddendum:
      'You are designing a mobile web application. Render every screen inside a phone-frame container (centered, 390×844 viewport, rounded corners, subtle shadow) so the layout is visibly mobile-first. Use a screen-routing approach (state-driven or a tiny router) so screens can be added/removed independently. Default to bottom-anchored primary actions, full-width buttons, and large tap targets. No desktop layouts.',
    emptyStateTitle: 'Design the screen, not the page.',
    emptyStateBody:
      'Describe the first screen a user sees when they open your app — the phone frame fills in around what you say.',
  },
  {
    id: 'slide-deck',
    name: 'Slide deck',
    tagline: 'A presentation that builds itself as you talk.',
    icon: Presentation,
    artifactKind: 'slide deck',

    classifierHint:
      'The room is building a presentation. Each unit of content is a slide. Vocabulary: "add a slide on X", "split this slide", "tighten the title slide", "move the agenda earlier", "add a closing slide".',
    decisionHint:
      'Phrase decisions as slide operations: "Add a slide outlining the problem", "Combine the two pricing slides", "Replace slide 3 with a comparison table".',
    executorAddendum:
      'You are building a slide presentation. Use one React component per slide, stored in a `slides/` directory, and a top-level Deck component that renders the current slide. Support keyboard nav (←/→) and on-screen prev/next + slide counter. Each slide should fill the viewport with a 16:9 layout, big readable typography, and at most one core idea. Title slide first, closing/CTA slide last. Use Tailwind exclusively — no slide-deck libraries.',
    emptyStateTitle: 'Tell the story, slide by slide.',
    emptyStateBody:
      'Say what you’re presenting and to whom — the deck will assemble itself as you go.',
  },
  {
    id: 'customer-journey',
    name: 'Customer journey',
    tagline: 'Phases, touchpoints, emotions across one journey.',
    icon: Route,
    artifactKind: 'customer journey map',

    classifierHint:
      'The room is mapping a customer journey. The canvas is organized by phases (columns) and rows (touchpoints, user thoughts, emotions, opportunities). Vocabulary: "add a phase", "split awareness into discovery + research", "add an emotional low at onboarding", "tag this as a pain point".',
    decisionHint:
      'Phrase decisions as journey-map edits: "Add a research phase before consideration", "Mark the onboarding step as a pain point", "Add a delight moment at first success".',
    executorAddendum:
      'You are building a customer journey map. Render a horizontal grid: phases as columns (Awareness, Consideration, Purchase, Onboarding, Retention by default — adapt to the use case), and rows for Touchpoints, Thoughts/Quotes, Emotion (a line chart curving up/down per phase), and Opportunities. Use Tailwind for the grid; the emotion line can be SVG or a simple chart lib. Each cell is editable as a small card. Persona summary up top.',
    emptyStateTitle: 'Walk in your user’s shoes.',
    emptyStateBody:
      'Describe the persona and how they discover you — the journey map will lay itself out across the canvas.',
  },
  {
    id: 'ux-flow',
    name: 'UX flow',
    tagline: 'Boxes-and-arrows for screens, decisions, and edges.',
    icon: Workflow,
    artifactKind: 'UX flow diagram',

    classifierHint:
      'The room is drawing a UX flow / wireflow. The canvas is a node-graph: screen nodes, decision nodes, and edges with labels. Vocabulary: "add a screen after login", "add a decision diamond for paid vs free", "label this edge", "remove the dead-end node".',
    decisionHint:
      'Phrase decisions as graph edits: "Add a verification step between signup and dashboard", "Branch the flow on subscription tier", "Remove the redundant confirmation screen".',
    executorAddendum:
      'You are building a UX flow diagram. Use a node-and-edge canvas — `@xyflow/react` is the strong default; install it on the first task if not present. Two node types: Screen (rectangle with label) and Decision (diamond). Edges can have labels. Provide drag-to-reposition. Keep the underlying graph state in a single JSON-y object so it is easy to edit programmatically on later tasks.',
    emptyStateTitle: 'Map the path, click by click.',
    emptyStateBody:
      'Start with the entry point — every screen, decision, and detour will get drawn as you describe them.',
  },
  {
    id: 'analytics-dashboard',
    name: 'Analytics dashboard',
    tagline: 'KPI cards + charts with sensible placeholder data.',
    icon: BarChart3,
    artifactKind: 'analytics dashboard',

    classifierHint:
      'The room is designing an analytics dashboard. Layout is a grid of KPI cards and charts. Vocabulary: "add an MRR chart", "split the conversion card", "add a date-range filter", "swap line chart for area".',
    decisionHint:
      'Phrase decisions in dashboard terms: "Add a 30-day signup trend chart", "Group the revenue cards into a top row", "Add a funnel chart for activation".',
    executorAddendum:
      'You are designing an analytics dashboard UI. Use a responsive grid of cards: top row for headline KPIs (number + delta + sparkline), then a 2-column area for charts. Use Recharts for charts (install on first task) and Tailwind for the card chrome. Populate every chart with realistic placeholder data — never empty states. Include a date-range selector in the header. No real data source.',
    emptyStateTitle: 'Numbers tell a story — what’s yours?',
    emptyStateBody:
      'Say what business you’re measuring — KPI cards, trend lines, and funnels will lay themselves out.',
  },
  {
    id: 'document',
    name: 'Document',
    tagline: 'Long-form writing that grows with the conversation.',
    icon: FileText,
    artifactKind: 'document',

    classifierHint:
      'The room is writing a long-form document. Content is structured by headings and paragraphs. Vocabulary: "tighten this section", "add a paragraph on X", "rewrite the intro", "split this into two sections", "add a callout".',
    decisionHint:
      'Phrase decisions as editorial moves: "Add a section on tradeoffs after the architecture", "Tighten the intro to two paragraphs", "Add a TL;DR at the top".',
    executorAddendum:
      'You are writing a long-form document. Render it like a clean reading view — one centered column, max ~700px wide, generous line height, serif or comfortable sans body font. Use semantic HTML headings (h1/h2/h3), real paragraphs, blockquotes for callouts. No sidebar, no nav. The content itself is the artifact. If markdown is appropriate, render it via react-markdown.',
    emptyStateTitle: 'Start with the first sentence.',
    emptyStateBody:
      'Say what this document is about — the structure, sections, and prose will fill in as you talk.',
  },
  {
    id: 'spreadsheet',
    name: 'Spreadsheet',
    tagline: 'A data grid you can talk into shape.',
    icon: Table,
    artifactKind: 'spreadsheet',

    classifierHint:
      'The room is building a data spreadsheet. Vocabulary is cells, rows, columns, totals. Examples: "add a column for margin", "fill the first 10 rows with example data", "make column C currency", "add a totals row".',
    decisionHint:
      'Phrase decisions as grid edits: "Add a Quantity × Price = Total column", "Sum the revenue column at the bottom", "Format the price column as currency".',
    executorAddendum:
      'You are building a spreadsheet/data-grid UI. Use `react-spreadsheet` (install on first task) for the editable grid. Provide column headers, basic formula support if asked (the lib has simple formulas), and a totals row when relevant. Keep the grid the entire canvas; minimal chrome. Persist data in component state.',
    emptyStateTitle: 'Numbers, in rows.',
    emptyStateBody:
      'Tell us what you’re tracking — columns, sample data, and totals will appear.',
  },
];

const TEMPLATES_BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

export function getTemplate(templateId: string | null | undefined): Template | null {
  if (!templateId) return null;
  return TEMPLATES_BY_ID.get(templateId) ?? null;
}

export function listTemplates(): Template[] {
  return TEMPLATES;
}

export function isValidTemplateId(id: string): boolean {
  return TEMPLATES_BY_ID.has(id);
}

// ---------------------------------------------------------------------------
// Legacy enum labels — kept so room cards / drawers from before the
// templates redesign still render their objective + output_type fields.
// New rooms have these set to null and use templateId instead.
// ---------------------------------------------------------------------------

export const OBJECTIVE_LABELS: Record<string, string> = {
  landing_page: 'Landing page',
  mobile_app_flow: 'Mobile app flow',
  product_concept: 'Product concept',
  website: 'Website',
  customer_journey: 'Customer journey',
  ux_copy: 'UX copy',
  business_solution: 'Business solution',
};

export const OUTPUT_TYPE_LABELS: Record<string, string> = {
  react_landing_page: 'React landing page',
  react_website: 'React website',
  react_mobile_screens: 'Mobile screens',
  react_dashboard: 'Dashboard',
  react_product_flow: 'Product flow',
  html_static: 'Static HTML',
};
