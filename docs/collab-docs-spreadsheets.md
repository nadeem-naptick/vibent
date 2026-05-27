# Real collaborative documents + spreadsheets — parking doc

> Parked 2026-05-27. Picks up when we want the `document` and `spreadsheet`
> templates to produce *actually editable* artifacts that the agent and
> humans both write to live — not React UIs that mimic them.

## What we're parking

Today the `document` and `spreadsheet` templates use the same Vite + React
sandbox as the other 6 — they render *visual approximations* of a doc or
sheet, not editable surfaces. The host wants:

- A real document that opens in the room. Agent writes into it. Humans can
  also type / edit / format. Concurrent edits merge cleanly.
- Same for spreadsheets (cells, formulas, multiple editors).
- Open source (no Google Docs / no SaaS lock-in).

## Recommended stack

**Core CRDT: Yjs.** Same family of tech behind Linear, parts of Figma,
many Notion-like apps. Reason: human edits and agent edits *merge*
automatically. No locks, no conflict resolution code, no "who wins".

| Layer | Documents | Spreadsheets |
|---|---|---|
| **Editor UI** | TipTap (ProseMirror-based, React-native) | Univer (open-source, formulas + formatting, Yjs-native) |
| **Sync transport** | Hocuspocus (open-source Yjs WS server) | same |
| **Storage** | Postgres `room_documents` table (Yjs binary state) | same |
| **Agent integration** | Server-side Yjs handle, direct mutations | same |

Spreadsheet alternative: `fortune-sheet` (Luckysheet fork) if Univer's
bundle size is a problem. Lean Univer for v1.

## Why not the alternatives

- **Google Docs / Sheets API** — not open source, OAuth/Drive permission
  ceremony per participant, awkward agent integration.
- **OnlyOffice / Collabora** — open source but heavyweight (full
  LibreOffice in browser, several-GB Docker image). Agent integration is
  poor — no programmatic document model the way Yjs has.
- **Etherpad** — OG collab docs, plain-text first, dated, no spreadsheet.
- **Cryptpad** — encrypted-first, overkill.
- **DIY over LiveKit data channels** — possible but reinvents CRDT
  semantics. Not worth it.

## Architectural impact (the fork)

Currently every template → Vite iframe. Doc + spreadsheet **don't fit
that model** — they're data, not code. The architecture splits:

```
Room render:
  templateId in ['document', 'spreadsheet']  →  <CollabDocument> | <CollabSpreadsheet>
  else                                       →  existing Vite iframe

Executor:
  templateId in ['document', 'spreadsheet']  →  runYjsTask  (new pipeline)
  else                                       →  runTask  (existing Claude Code path)
```

The 6 "build a UI" templates stay as they are. The 2 "edit data"
templates get a new pipeline.

## Agent tool surface

Today's executor uses `write_file` / `read_file` / `install_packages`
against a sandbox. For doc/sheet, the LLM gets a completely different
tool set that targets the Yjs doc:

**Document** (TipTap/Yjs):
```
append_paragraph(text)
add_heading(level, text)
replace_section(by_heading, new_text)
add_callout(text)
add_bullet_list(items)
```

**Spreadsheet** (Univer/Yjs):
```
set_cell(row, col, value)
set_range(start, end, values)
add_column(header, formula?)
set_formula(cell, formula)
sum_column(col)
```

CRDT handles concurrent human typing automatically.

## Scope estimate

- **Hocuspocus server**: ~50 lines + Postgres adapter (same Next.js
  process — fewer moving parts than a separate service)
- **DB**: 1 new table `room_documents (room_id PK, doc_type, yjs_state BYTEA, updated_at)`
- **`<CollabDocument>`**: ~150 lines (TipTap + Yjs + Hocuspocus client)
- **`<CollabSpreadsheet>`**: ~100 lines (Univer wires most of it)
- **`lib/exec/run-yjs-task.ts`**: ~200 lines (server-side Yjs writer +
  tool-use loop)
- **Room page renderer routing** + dashboard rendering — small
- **Versions / rollback** for Yjs docs — non-trivial; needs its own pass

Total: **2-3 days of focused work** for docs + spreadsheets end-to-end.
Documents alone in 1 day.

## Open questions to resolve before starting

1. **Spreadsheet library** — Univer (newer, fuller, +50KB gz heavier)
   vs `fortune-sheet` (Luckysheet fork, lighter). Lean Univer.
2. **Hocuspocus host** — same Next.js process (simpler) vs separate Node
   service (cleaner). Lean same Next.js.
3. **Agent edit cadence** — stream char-by-char (feels alive, but ugly
   if a human is typing in the same paragraph) vs paste whole sections
   atomically (clean diff, less "live"). No strong opinion.
4. **Versions / rollback** — snapshot Yjs state to S3 on each successful
   task (consistent with sandbox versioning) vs rely on Yjs internal
   history for v1.
5. **Should we eventually migrate the other 6 templates to Yjs too?**
   Would unify the model. Bigger rebuild. Defer until docs + sheets
   prove out.

## Notes on agent + human interaction

CRDT correctness is free — Yjs handles it. The real UX question is
*social*: when the agent is writing a long section and a human starts
typing in the same paragraph, what happens visually? Reasonable
guardrails for v1:

- Agent edits at well-defined anchors (end of doc, end of a specific
  section by heading) — humans rarely fight for those locations.
- Show the agent's presence as a distinctly-styled cursor / username
  ("AI · vibent") so humans can see where it's working.
- If a human starts editing the same paragraph as the agent, pause
  agent edits for ~3s (server-side guard).

These are policy, not technology. Yjs lets us implement any of them.

## Cross-references

- See [[templates-redesign]] (`docs/templates-redesign.md`) for the
  original parked plan — superseded by the prompt-only template approach
  shipped in commit `a948c56`. This doc is the next layer: replacing the
  *rendering* for doc + sheet templates specifically.
- See `lib/templates/index.ts` for the current template definitions.
- See `lib/exec/run-task.ts` for the current executor that this would
  bifurcate from.
