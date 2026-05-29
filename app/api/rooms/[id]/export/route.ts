import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms } from '@/lib/db/schema';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { buildAndCollect, BuildError, type BuiltFile } from '@/lib/exec/build-and-collect';

// Inline the JS + CSS produced by `vite build` into the HTML directly,
// returning a self-contained HTML string + any leftover binary assets
// (fonts, images, etc.) that we can't safely turn into data URIs.
//
// Why: Vite's default output uses `<script type="module" src="./assets/...">`,
// and `file://` URLs can't load external ES modules (Chrome / Safari CORS
// block). Double-clicking the unzipped HTML produces a blank page. Inlining
// the entry script + stylesheet removes all external fetches so the file
// just works when opened directly.
function inlineAssets(
  html: string,
  files: BuiltFile[],
): { html: string; remaining: BuiltFile[] } {
  const fileMap = new Map(files.map((f) => [f.path, f]));
  const consumed = new Set<string>();

  // Inline <script ... src="./assets/foo.js"></script>
  let out = html.replace(
    /<script\s+([^>]*?)src=["']\.\/([^"']+\.js)["']([^>]*?)>\s*<\/script>/gi,
    (match, before: string, path: string, after: string) => {
      const file = fileMap.get(path);
      if (!file) return match;
      consumed.add(path);
      const isModule = /type=["']module["']/i.test(before + ' ' + after);
      const typeAttr = isModule ? ' type="module"' : '';
      return `<script${typeAttr}>${file.content.toString('utf-8')}</script>`;
    },
  );

  // Inline <link rel="stylesheet" href="./assets/foo.css">
  out = out.replace(
    /<link\s+([^>]*?)>/gi,
    (match, attrs: string) => {
      if (!/rel=["']stylesheet["']/i.test(attrs)) return match;
      const href = attrs.match(/href=["']\.\/([^"']+\.css)["']/);
      if (!href) return match;
      const file = fileMap.get(href[1]);
      if (!file) return match;
      consumed.add(href[1]);
      return `<style>${file.content.toString('utf-8')}</style>`;
    },
  );

  const remaining = files.filter(
    (f) => f.path !== 'index.html' && !consumed.has(f.path),
  );
  return { html: out, remaining };
}

// POST /api/rooms/[id]/export
// Builds the room's current artifact (Vite production build) and returns
// the dist/ as a single ZIP the user can download + open locally.
// Base path is set to './' so all asset references work relative — index.html
// can be opened directly without a server.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  if (!room) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (room.hostUserId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!room.sandboxId) {
    return NextResponse.json({ error: 'no sandbox provisioned' }, { status: 400 });
  }

  const sandbox = sandboxManager.getProvider(room.sandboxId);
  if (!sandbox) {
    return NextResponse.json(
      { error: 'sandbox not currently attached — open the room first and try again' },
      { status: 503 },
    );
  }

  try {
    const files = await buildAndCollect(sandbox, { base: './' });
    const safeTitle =
      (room.title || 'export')
        .replace(/[^a-z0-9-]/gi, '-')
        .replace(/-+/g, '-')
        .toLowerCase()
        .slice(0, 40)
        .replace(/^-|-$/g, '') || 'export';

    const indexFile = files.find((f) => f.path === 'index.html');
    if (!indexFile) {
      return NextResponse.json(
        { error: 'build did not produce an index.html' },
        { status: 500 },
      );
    }
    const { html, remaining } = inlineAssets(
      indexFile.content.toString('utf-8'),
      files,
    );

    // Common case: a vanilla React+Vite landing page builds to one JS + one
    // CSS, both inlined now. Return the single self-contained HTML — opens
    // directly from a double-click, no extraction step.
    if (remaining.length === 0) {
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="vibemtg-${safeTitle}.html"`,
        },
      });
    }

    // Project has binary assets (fonts, images) we can't inline. Ship a ZIP
    // with the rewritten index.html + remaining assets. Still opens
    // correctly from file:// because the inlined entry script + CSS don't
    // require a fetch; only the binary assets are read via relative paths,
    // which browsers allow.
    const zip = new JSZip();
    zip.file('index.html', html);
    for (const f of remaining) {
      zip.file(f.path, f.content);
    }
    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="vibemtg-${safeTitle}.zip"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err) {
    if (err instanceof BuildError) {
      console.warn('[export] build failed:', err.message);
      return NextResponse.json(
        { error: 'build_failed', detail: err.message },
        { status: 500 },
      );
    }
    console.error('[export] unexpected error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'export failed' },
      { status: 500 },
    );
  }
}
