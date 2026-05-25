import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { classifyUtterance, type IntelProvider } from '@/lib/intel/classify';

// Server-side classifier endpoint. Mainly used for testing / dev probing —
// the real call path is /api/transcripts which classifies inline.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.text || !body?.speakerName) {
    return NextResponse.json(
      { error: 'text and speakerName are required' },
      { status: 400 },
    );
  }

  try {
    const intent = await classifyUtterance({
      text: String(body.text),
      speakerName: String(body.speakerName),
      roomObjective: body.roomObjective,
      recentContext: body.recentContext,
      provider: body.provider as IntelProvider | undefined,
    });
    return NextResponse.json(intent);
  } catch (err) {
    console.error('[intel/classify] failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'classify failed' },
      { status: 500 },
    );
  }
}
