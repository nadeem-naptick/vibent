import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/projects';

// Mint a short-lived Deepgram scoped key so the browser can connect directly
// to Deepgram's WebSocket for live transcription without exposing the master
// API key.
//
// Docs: https://developers.deepgram.com/docs/grant-temporary-access-to-the-deepgram-api
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

  // First, look up the project id (Deepgram needs it to scope a key).
  let projectId: string;
  try {
    const projectsRes = await fetch(DEEPGRAM_API_URL, {
      headers: { Authorization: `Token ${apiKey}` },
    });
    if (!projectsRes.ok) {
      const t = await projectsRes.text();
      throw new Error(`projects list failed: ${projectsRes.status} ${t}`);
    }
    const projectsBody = (await projectsRes.json()) as {
      projects: { project_id: string }[];
    };
    projectId = projectsBody.projects?.[0]?.project_id;
    if (!projectId) throw new Error('no Deepgram project found');
  } catch (err) {
    console.error('[deepgram/token] project lookup failed:', err);
    return NextResponse.json({ error: 'deepgram project lookup failed' }, { status: 500 });
  }

  // Mint a temporary key scoped to live transcription only, 1 hour TTL.
  try {
    const mintRes = await fetch(`${DEEPGRAM_API_URL}/${projectId}/keys`, {
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
    if (!mintRes.ok) {
      const t = await mintRes.text();
      throw new Error(`key mint failed: ${mintRes.status} ${t}`);
    }
    const keyBody = (await mintRes.json()) as { key: string };
    return NextResponse.json({ key: keyBody.key });
  } catch (err) {
    console.error('[deepgram/token] mint failed:', err);
    return NextResponse.json({ error: 'deepgram key mint failed' }, { status: 500 });
  }
}
