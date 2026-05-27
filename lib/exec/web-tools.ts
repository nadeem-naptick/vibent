import { tool } from 'ai';
import { z } from 'zod';
import { Firecrawl } from '@mendable/firecrawl-js';

// Lazy singleton — only construct when first used so missing keys don't
// crash module load for tasks that never call these tools.
let _client: Firecrawl | null = null;
function client(): Firecrawl | null {
  if (_client) return _client;
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey || apiKey === 'your_firecrawl_api_key') return null;
  _client = new Firecrawl({ apiKey });
  return _client;
}

// Cap on scraped page content so a single fetch can't blow the agent's
// context window. The agent can always fetch a more specific URL if it
// needs deeper content.
const MAX_MARKDOWN_CHARS = 8000;

// Cap on search results we return — keeps the response compact and forces
// the agent to be specific in its query.
const DEFAULT_SEARCH_LIMIT = 5;
const MAX_SEARCH_LIMIT = 10;

function unavailable(toolName: string) {
  return {
    ok: false as const,
    error: `${toolName} unavailable: FIRECRAWL_API_KEY is not configured`,
  };
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// Web tools the execution agent uses to ground its work in real, live
// content from the public internet. Authenticated/per-user data (HubSpot,
// GA4, Notion, etc.) is a separate layer — see docs/integrations-research.md.
export function createWebTools() {
  return {
    web_search: tool({
      description:
        'Search the public web. Use this when the task references a real product, company, or live information you need to ground your work in (e.g. "look at how Linear styles their pricing", "find the actual logo colors of Stripe"). Returns top results with title, URL, and short description — call fetch_url on the most relevant URL afterward if you need the full content. Costs real money and ~2-5 seconds per call; be specific in your query and avoid running speculative searches.',
      inputSchema: z.object({
        query: z
          .string()
          .min(2)
          .max(400)
          .describe('The search query. Be specific — "Linear pricing page" beats "saas pricing".'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_SEARCH_LIMIT)
          .optional()
          .describe(`Max results to return. Default ${DEFAULT_SEARCH_LIMIT}, max ${MAX_SEARCH_LIMIT}.`),
      }),
      execute: async ({ query, limit }) => {
        const fc = client();
        if (!fc) return unavailable('web_search');
        try {
          const data = await fc.search(query, {
            limit: limit ?? DEFAULT_SEARCH_LIMIT,
            sources: ['web'],
          });
          // data.web can be SearchResultWeb (url/title/description at top
          // level) or Document (everything under .metadata) — depends on
          // whether scrapeOptions was passed. Pull from both shapes with a
          // loose accessor; the runtime shape is well-defined even if TS
          // sees the union ambiguously.
          const results = (data.web ?? []).map((r) => {
            const raw = r as Record<string, unknown>;
            const meta = (raw.metadata as Record<string, unknown> | undefined) ?? {};
            return {
              title: (raw.title ?? meta.title) as string | undefined,
              url: (raw.url ?? meta.url) as string | undefined,
              description: (raw.description ?? meta.description) as string | undefined,
            };
          });
          return { ok: true as const, results };
        } catch (err) {
          return { ok: false as const, error: errMsg(err) };
        }
      },
    }),

    fetch_url: tool({
      description:
        'Fetch the main content of a specific URL as Markdown. Use this after web_search to read a page in detail, or when you already know the URL (e.g. user said "match acme.com\'s hero"). Returns markdown of the main article/content (boilerplate stripped). Long pages are truncated to ~8000 chars — fetch a more specific URL if you need deeper content. Costs real money and ~5-15 seconds per call; one fetch per task is usually enough.',
      inputSchema: z.object({
        url: z.string().url().describe('Full URL including https://'),
      }),
      execute: async ({ url }) => {
        const fc = client();
        if (!fc) return unavailable('fetch_url');
        try {
          const doc = await fc.scrape(url, {
            formats: ['markdown'],
            onlyMainContent: true,
          });
          let markdown = doc.markdown ?? '';
          const truncated = markdown.length > MAX_MARKDOWN_CHARS;
          if (truncated) markdown = markdown.slice(0, MAX_MARKDOWN_CHARS);
          return {
            ok: true as const,
            url,
            title: doc.metadata?.title,
            description: doc.metadata?.description,
            markdown,
            truncated,
          };
        } catch (err) {
          return { ok: false as const, error: errMsg(err) };
        }
      },
    }),
  };
}
