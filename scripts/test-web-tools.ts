// Standalone smoke test for the web research tools.
// Run: npx tsx scripts/test-web-tools.ts
//
// Validates: FIRECRAWL_API_KEY env loads, the Firecrawl SDK responds, our
// thin wrappers in lib/exec/web-tools.ts shape the output correctly.
// Does NOT exercise the agent loop — that requires the full Next.js +
// LiveKit + sandbox stack and a browser session.

import 'dotenv/config';
import { createWebTools } from '../lib/exec/web-tools';

// Loose any-typed call helper — Vercel AI SDK's tool.execute has a union
// type that includes AsyncIterable, but at runtime our tools always return
// the plain shape. Type-narrow with `as any` for this one-off smoke test.
type CallTool = (args: Record<string, unknown>) => Promise<{ ok: boolean; [k: string]: unknown }>;

async function main() {
  const tools = createWebTools();

  const callSearch = tools.web_search.execute as unknown as CallTool;
  const callFetch = tools.fetch_url.execute as unknown as CallTool;

  console.log('\n[1/2] web_search("Linear pricing")');
  const sres = (await callSearch({ query: 'Linear pricing', limit: 3 })) as {
    ok: boolean;
    error?: string;
    results?: Array<{ title?: string; url?: string }>;
  };
  if (!sres.ok) {
    console.error('  ✗', sres.error);
    process.exit(1);
  }
  console.log(`  ✓ ${sres.results!.length} results`);
  for (const r of sres.results!) {
    console.log(`    - ${r.title?.slice(0, 60)}`);
    console.log(`      ${r.url}`);
  }
  const firstUrl = sres.results!.find((r) => r.url)?.url;
  if (!firstUrl) {
    console.error('  ✗ no URL in any result to follow up with fetch_url');
    process.exit(1);
  }

  console.log(`\n[2/2] fetch_url("${firstUrl}")`);
  const fres = (await callFetch({ url: firstUrl })) as {
    ok: boolean;
    error?: string;
    title?: string;
    markdown?: string;
    truncated?: boolean;
  };
  if (!fres.ok) {
    console.error('  ✗', fres.error);
    process.exit(1);
  }
  console.log(`  ✓ title: ${fres.title}`);
  console.log(`    markdown: ${fres.markdown!.length} chars (truncated=${fres.truncated})`);
  console.log(`    preview:\n${fres.markdown!.slice(0, 400).replace(/^/gm, '      ')}`);

  console.log('\nAll good — web tools work.\n');
}

main().catch((err) => {
  console.error('\nFAILED:', err.message ?? err);
  process.exit(1);
});
