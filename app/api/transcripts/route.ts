import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms } from '@/lib/db/schema';
import {
  ensureIndexes,
  getIntentsCollection,
  getTranscriptsCollection,
  type DetectedIntent,
  type TranscriptSegment,
} from '@/lib/db/mongo';
import { classifyUtterance } from '@/lib/intel/classify';

// Persist a transcript segment. If it's a final result, run the intelligence
// classifier inline and persist the resulting intent. Return the intent so the
// caller can publish it on the LiveKit data channel.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const segment: TranscriptSegment = {
    id: String(body.id ?? nanoid()),
    roomId: String(body.roomId),
    speakerId: String(body.speakerId),
    speakerName: String(body.speakerName),
    text: String(body.text).trim(),
    isFinal: Boolean(body.isFinal),
    startMs: Number(body.startMs ?? 0),
    endMs: Number(body.endMs ?? 0),
    createdAt: new Date(),
  };

  if (!segment.roomId || !segment.speakerId || !segment.text) {
    return NextResponse.json(
      { error: 'roomId, speakerId, text required' },
      { status: 400 },
    );
  }

  await ensureIndexes();

  const transcripts = await getTranscriptsCollection();

  // Upsert by id so re-sending the same segment is harmless.
  await transcripts.updateOne(
    { id: segment.id },
    { $set: segment },
    { upsert: true },
  );

  // Only classify final utterances and skip very short ones (< 6 chars).
  if (!segment.isFinal || segment.text.length < 6) {
    return NextResponse.json({ transcript: segment, intent: null });
  }

  // Pull recent context: last ~10 finals from same room.
  const recent = await transcripts
    .find({ roomId: segment.roomId, isFinal: true })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  const recentContext = recent
    .reverse()
    .slice(0, -1) // exclude this segment we just inserted
    .map((s) => `${s.speakerName}: ${s.text}`)
    .join('\n');

  // Fetch room objective for prompt grounding.
  const [room] = await db.select().from(rooms).where(eq(rooms.id, segment.roomId)).limit(1);

  let intent: DetectedIntent | null = null;
  try {
    const classified = await classifyUtterance({
      text: segment.text,
      speakerName: segment.speakerName,
      roomObjective: room?.objective,
      recentContext,
    });

    // Skip persisting pure noise — keeps the panel clean.
    if (classified.type !== 'noise') {
      intent = {
        id: nanoid(),
        roomId: segment.roomId,
        type: classified.type,
        status: 'pending_approval',
        confidence: classified.confidence,
        summary: classified.summary,
        rawText: segment.text,
        sourceTranscriptIds: [segment.id],
        speakerId: segment.speakerId,
        speakerName: segment.speakerName,
        shouldExecute: classified.shouldExecute,
        createdAt: new Date(),
      };
      const intents = await getIntentsCollection();
      await intents.insertOne(intent);
    }
  } catch (err) {
    console.error('[transcripts] classify failed:', err);
    // Don't fail the whole request — the transcript is still saved.
  }

  return NextResponse.json({ transcript: segment, intent });
}
