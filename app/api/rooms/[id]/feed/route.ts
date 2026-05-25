import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms } from '@/lib/db/schema';
import {
  ensureIndexes,
  getIntentsCollection,
  getTranscriptsCollection,
} from '@/lib/db/mongo';

// Initial page-load feed for the AI panel: most recent transcripts + intents.
export async function GET(
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

  await ensureIndexes();
  const transcripts = await getTranscriptsCollection();
  const intents = await getIntentsCollection();

  const [recentTranscripts, recentIntents] = await Promise.all([
    transcripts
      .find({ roomId: id })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()
      .then((arr) => arr.reverse()),
    intents.find({ roomId: id }).sort({ createdAt: -1 }).limit(50).toArray(),
  ]);

  return NextResponse.json({
    transcripts: recentTranscripts,
    intents: recentIntents,
  });
}
