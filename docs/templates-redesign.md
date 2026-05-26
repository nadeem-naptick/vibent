# Templates redesign — parking doc

> Parked 2026-05-26. Pick this back up once production + S3 storage are in place.

## Why

Current "create room" form asks for Objective + Output Type + Template + lots of
context fields. We want to collapse this to: **room name + a grid of template
cards**. Selecting a template should end-to-end determine the artifact the
agent produces (slide deck vs. landing page vs. spreadsheet) — not just be a
visual filter on a generic React scaffold.

## New form layout

- Single text input: room name
- 2-row × 4-column grid of template cards (scrollable for more)
- Collapsible "Add context (optional)" section preserving the existing fields
- Single primary action: Create

## Architecture: one runtime, many scaffolds

Every template still runs in the same Vite + React + Tailwind sandbox. The
template defines:

- **`scaffold`** — exact starter files written into the sandbox on
  provision (instead of the generic React app)
- **`systemPromptAddendum`** — appended to the executor's system prompt so it
  knows the artifact kind and editing conventions
- **`classifierHint`** — optional nudge so the intent classifier phrases
  decisions in the right vocabulary ("add slide" vs. "add section")
- **`artifactKind`** — short human label ("slide deck", "spreadsheet")
- **`icon`** + **`tagline`** — for the grid card
- **`comingSoon`** + **`requires`** — for connector-gated templates

Renderer doesn't change — still iframe to Vite.

```ts
type Template = {
  id: string;
  name: string;
  tagline: string;
  icon: LucideIcon;
  artifactKind: string;
  scaffold: Record<string, string>;
  systemPromptAddendum: string;
  classifierHint?: string;
  comingSoon?: boolean;
  requires?: string[];
};
```

## Templates to ship in v1 (web-runtime, no connectors)

| # | Template | Scaffold sketch | Library |
|---|---|---|---|
| 1 | Landing page | Hero + features + CTA single-page | — |
| 2 | Mobile web app | Phone-frame layout, mobile-first | — |
| 3 | Slide deck | `<Slide>` components, arrow nav | reveal.js OR hand-rolled |
| 4 | Customer journey | Phases × touchpoints × emotion line | — |
| 5 | UX flow | Nodes + edges canvas | @xyflow/react |
| 6 | Analytics dashboard | KPI cards + charts (placeholder data) | Tremor / Recharts |
| 7 | Document | Long-form markdown doc | react-markdown |
| 8 | Spreadsheet | Editable cell grid | react-spreadsheet |

## Connector-gated (coming soon)

- **GA dashboard** — Google Analytics OAuth
- **Meta Ads dashboard** — Meta Ads OAuth
- **Mobile native app** — Expo / RN-Web preview

## Downstream changes when this lands

- `provisionRoomSandbox` writes `template.scaffold` instead of the generic
  React app.
- `runTask` system prompt appends `template.systemPromptAddendum`.
- Classifier injects `template.classifierHint` into its prompt so detections
  use template vocabulary.
- DB: rooms table stores `templateId`; drop `objective` / `outputType` columns
  (or keep as derived for backwards compat — TBD).
- Form: replace the current `CreateRoomForm` with the grid picker.

## Open questions

1. Slide deck library — reveal.js (battle-tested) vs. hand-rolled `<Slide>`
   (simpler for the agent to edit). Leaning hand-rolled.
2. Spreadsheet — `react-spreadsheet` (simple) vs. `react-data-grid` (heavier,
   supports formulas) vs. hand-rolled. Leaning `react-spreadsheet`.
3. Ship all 8 at once or start with 4 (landing + slide + journey + dashboard)
   and add the rest in a follow-up.
