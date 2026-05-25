import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const DEEPGRAM_PROJECTS_URL = 'https://api.deepgram.com/v1/projects';

// Issue a Deepgram key the browser can use for live transcription.
//
// Two modes:
//   1. SCOPED MODE — if the master key has the `keys:write` scope, we mint a
//      short-lived sub-key per request. Recommended for prod.
//   2. DIRECT MODE (fallback) — if the master key lacks key-minting scope
//      (most Deepgram free/starter accounts don't grant it), we serve the
//      master key directly. The endpoint is still session-protected so only
//      signed-in users can fetch it, but the key does end up in the browser.
//      Fine for dev; for prod, upgrade the master key permissions and the
//      endpoint will start minting scoped keys automatically.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'DEEPGRAM_API_KEY not configured' },
      { status: 500 },
    );
  }

  // Try scoped mode first.
  try {
    const projectsRes = await fetch(DEEPGRAM_PROJECTS_URL, {
      headers: { Authorization: `Token ${apiKey}` },
    });
    if (!projectsRes.ok) {
      // Master key invalid; nothing we can do.
      const t = await projectsRes.text();
      console.error('[deepgram/token] master key check failed:', projectsRes.status, t);
      return NextResponse.json({ error: 'invalid Deepgram key' }, { status: 500 });
    }
    const { projects } = (await projectsRes.json()) as {
      projects: { project_id: string }[];
    };
    const projectId = projects?.[0]?.project_id;
    if (!projectId) {
      return NextResponse.json({ error: 'no Deepgram project found' }, { status: 500 });
    }

    const mintRes = await fetch(`${DEEPGRAM_PROJECTS_URL}/${projectId}/keys`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: `agentic-room user ${session.user.id}`,
        scopes: ['usage:write'],
        time_to_live_in_seconds: 3600,
      }),
    });
    if (mintRes.ok) {
      const { key } = (await mintRes.json()) as { key: string };
      return NextResponse.json({ key, mode: 'scoped' });
    }
    // Fall through to direct mode for INSUFFICIENT_PERMISSIONS etc.
    console.warn(
      '[deepgram/token] scoped mint failed (status %d) — falling back to direct mode. Upgrade the master key to include keys:write to enable scoped tokens.',
      mintRes.status,
    );
  } catch (err) {
    console.warn('[deepgram/token] scoped mint errored — falling back:', err);
  }

  // Direct mode fallback.
  return NextResponse.json({ key: apiKey, mode: 'direct' });
}
