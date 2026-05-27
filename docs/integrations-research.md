# Integrations layer — research + parked plan

> Parked 2026-05-27. Picks up when we want the executor agent to pull data
> from external services (Google Analytics, Notion, Slack, etc.) during a
> task, not just edit sandbox files.

## What we want

While participants talk and the agent builds, the agent should also be
able to:

1. **Search the public web** — grounding content with real research
2. **Fetch authenticated data** from the user's connected services
   (their GA4, their Notion workspace, their HubSpot CRM, etc.)

The integrations layer enables the second one.

## Hard constraint (user-stated)

**No per-provider OAuth app creation.** We do NOT want to register a
developer app on Google Cloud Console + a Meta app on developers.facebook
+ a Slack app + etc. That's days of registration, app-review, and
key-management work we want to skip — especially in v1.

This rules out:

- **DIY OAuth per provider** — exactly what we're avoiding
- **Nango OSS self-hosted** — still requires bringing your own OAuth
  apps for production use (and ~5 CPUs + 10GB RAM infra)
- Any service that doesn't pre-register OAuth apps with providers

## Shortlist of services that solve this

| Service | Coverage | Shared OAuth | AI-agent native | Free tier | Notes |
|---|---|---|---|---|---|
| **Composio** ⭐ | 1,000+ apps | ✅ Fully managed | ✅ MCP server, built for agents | **20K tool calls/mo** | Best fit for vibent |
| **Pipedream Connect** | 2,700+ apps | ✅ Default is their app | ⚠️ MCP supported, more general | Free tier exists | Broader catalog but less AI-native |
| **Nango Cloud (Free)** | 800+ apps | ⚠️ Dev only (prod = own apps) | ⚠️ MCP gated to Growth $500/mo | 10 connections | Cleanest dashboard, but free tier is "testing only" |

## Recommended: Composio

Reasons:
- Built around AI agent tool-calling (matches vibent's executor model)
- MCP server included on free tier
- 20K tool calls/month is generous (~600/day) — covers early usage
- Fully managed OAuth out of the box for all 1000+ providers
- Pricing scales reasonably: $29 → 200K calls, $229 → 2M calls

Pricing tiers:

| Plan | Price | Tool calls/mo |
|---|---|---|
| Free | $0 | 20K |
| Starter | $29 | 200K |
| Pro | $229 | 2M |
| Enterprise | custom | custom |

## The branding tradeoff with shared OAuth

When the user clicks "Connect Google Drive", they see **"Composio wants
to access your Google Drive"** instead of **"Vibent wants to access..."**.

Acceptable for v1 + early users; worth fixing for launch. Migration
path: register vibent's own OAuth apps for the 2-3 providers users
notice most (Google, Meta) and pass them as custom OAuth clients to
Composio. Keep using shared apps for everything else.

## Provider-side gates (no service avoids these)

Some integrations require provider-mandated onboarding regardless of
which middle-layer we pick:

| Integration | Provider-side gate |
|---|---|
| **WhatsApp Business** | Meta Business Manager + WBA + phone verification |
| **Meta Ads** (`ads_management`) | Meta app review for production capabilities |
| **TikTok** (organic + ads) | Closed developer program, approval delays |
| **LinkedIn write/post** | Restricted partner program (read is open) |
| **Twitter/X write** | Paid API tier required |
| **Instagram Graph** | Meta business setup |

Read flows for most others are clean via shared OAuth.

## Target integration list (25 across 5 categories)

**Analytics & ads** — for `analytics-dashboard` rooms
1. Google Analytics 4 ✅
2. Google Ads ✅
3. Meta Ads ⚠️ (Meta gates)
4. LinkedIn Ads ⚠️
5. TikTok Ads ⚠️ (gated)

**Productivity** — for `document`, `spreadsheet`, general grounding
6. Google Drive ✅
7. Google Sheets ✅
8. Google Docs ✅
9. Gmail (read) ✅
10. Google Calendar ✅
11. Notion ✅

**Communication** — for context + outbound
12. Slack ✅
13. WhatsApp Business ⚠️ (Meta onboarding)
14. Discord ✅
15. Telegram ✅

**Social** — for `landing-page`, content grounding
16. LinkedIn (read) ✅
17. Twitter/X (read) ✅
18. Instagram Graph ⚠️
19. Facebook Pages ✅
20. YouTube ✅

**CRM + revenue** — for dashboards
21. HubSpot ✅
22. Stripe ✅
23. Salesforce ✅

**Dev/research bonus**
24. GitHub ✅
25. Linear ✅

About 18 of 25 work out-of-the-box via Composio shared OAuth. ~7 have
provider-side gates.

## Two integration tracks (separate concerns)

| Track | Tool layer | What it does | Cost |
|---|---|---|---|
| **A. Public web** | **Firecrawl** (already in `.env` as `FIRECRAWL_API_KEY`) | Web search + scrape any URL | Already paid |
| **B. Authorized data** | **Composio** | Pull from user's connected services | Free → $29/mo |

Track A is free, available today, and unblocks "agent searches the web"
in a single afternoon of wiring. Track B is the bigger commitment.

## Architecture sketch

### Database
```sql
-- Per-user connections to external services
CREATE TABLE integration_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  room_id TEXT NULL REFERENCES rooms(id),    -- nullable: account-level vs room-scoped
  provider TEXT NOT NULL,                     -- 'google_analytics', 'slack', etc.
  composio_connection_id TEXT NOT NULL,       -- opaque ID returned by Composio
  display_name TEXT,                          -- e.g. "Acme Workspace"
  scopes JSONB,
  connected_at TIMESTAMP NOT NULL,
  last_used_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active'
);
```

### Agent tool surface (executor — `lib/exec/run-task.ts`)

Existing tools:
```
list_files · read_file · write_file · install_packages · run_command · check_preview
```

Add (Track A — web):
```
web_search(query, limit)              # Firecrawl search
fetch_url(url)                        # Firecrawl scrape
```

Add (Track B — authorized):
```
list_connections()                                       # what's connected for this room/user
execute_action(provider, action, args)                   # one-shot via Composio
fetch_records(provider, model, filter?)                  # cached data via Composio
```

System prompt gets injected with the available connections:
```
Connected data sources for this room:
- Google Analytics (user: nadeem@x.com, property: 123456)
- Notion (workspace: Vibent)
- Slack (workspace: vibent-team)

Use execute_action / fetch_records when relevant.
```

### Room flow

1. **In create-room form**: optional "Connect data sources" step with a
   grid filtered by template (analytics-dashboard suggests GA4 + Stripe;
   document suggests Notion + Drive; etc.)
2. **Each Connect button** opens Composio's hosted OAuth popup → user
   authorizes → Composio returns `connectionId` → we store in
   `integration_connections`
3. **In-room**: small "Connections" pill in toolbar shows what's wired,
   add more anytime
4. **Agent**: tools available on every task; system prompt lists what's
   connected

## Proactive vs reactive (later milestone)

User mentioned wanting the agent to pull data *while people are
talking*, not just on decision execution. Two interpretations:

| Mode | When agent pulls | Complexity |
|---|---|---|
| **Reactive (v1)** | Only when a decision triggers a task — agent has new tools | Low — additive |
| **Proactive (v2)** | Lightweight background agent watches transcripts, pre-fetches data when keywords appear ("our Stripe revenue") | Higher — new pipeline, can be noisy + expensive |

Start reactive. Revisit proactive after seeing how often the executor
actually calls integration tools in real usage.

## Open questions before starting

1. **Track A vs Track B vs both first?** Lean both — Track A is free and
   1 hour of work, Track B is the user's actual ask.
2. **Connection scope** — account-level (user connects once, all their
   rooms see it) or room-level (connect per room)? Room-level is more
   work but more privacy-friendly.
3. **First 10 integrations to wire** — once user picks, build the
   connection UI + verify each works end-to-end.
4. **OAuth branding** — accept "Composio wants to access" for v1 and
   migrate to own apps for Google + Meta later?

## Cross-references

- `lib/exec/run-task.ts` — current executor that this would extend
- `lib/exec/sandbox-tools.ts` — current tool implementations (template
  to copy for new integration tools)
- `lib/templates/index.ts` — templates that would advertise relevant
  integrations in their picker UI
- See [[collab-docs-spreadsheets]] for the other major parked direction
- See [[templates-redesign]] for the original UI direction (shipped as
  prompt-only templates in commit a948c56)
